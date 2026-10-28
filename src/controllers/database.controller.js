const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const userModel = require('../models/user.model')
const musicModel = require('../models/music.model')
const local = require('../services/local.service')
const catalog = require('../data/catalog.json')

function userIdFromCookie(req) {
  try { return jwt.verify(req.cookies.token, process.env.JWT_SECRET).id } catch (_) { return null }
}

async function status(req, res) {
  const userId = userIdFromCookie(req)
  if (process.env.STORAGE_MODE === 'local') {
    const snapshot = local.snapshot()
    const current = snapshot.users.find(user => user.id === userId)
    return res.json({
      mode: 'local',
      connection: 'active',
      database: 'data/store.json',
      note: 'Local storage is active because the configured MongoDB credentials were rejected. Set STORAGE_MODE=mongo and correct MONGO_URI to use MongoDB.',
      collections: [
        { name: 'users', count: snapshot.users.length, documents: current ? [{ _id: current.id, username: current.username, role: current.role, savedTracks: current.savedTracks }] : [] },
        { name: 'starterCatalog', count: catalog.length, documents: catalog.map(track => ({ _id: track.id, title: track.title, artist: track.artist, genre: track.genre, license: track.license })) },
        { name: 'uploads', count: snapshot.tracks.length, documents: snapshot.tracks.map(track => ({ _id: track.id, title: track.title, artistId: track.artistId, uri: track.uri })) },
      ],
    })
  }
  if (mongoose.connection.readyState !== 1) {
    return res.json({ mode: 'mongodb', connection: 'disconnected', database: 'MongoDB', note: 'MongoDB is not connected. Check MONGO_URI in .env.', collections: [] })
  }
  try {
    const [userCount, trackCount, current, tracks] = await Promise.all([
      userModel.countDocuments(),
      musicModel.countDocuments(),
      userId ? userModel.findById(userId).select('username role savedTracks').lean() : null,
      musicModel.find().select('catalogId title artistName source genre uri license').limit(30).lean(),
    ])
    res.json({
      mode: 'mongodb',
      connection: 'connected',
      database: mongoose.connection.db.databaseName,
      note: 'The Node.js API is reading these documents from MongoDB.',
      collections: [
        { name: 'users', count: userCount, documents: current ? [{ _id: String(current._id), username: current.username, role: current.role, savedTracks: current.savedTracks || [] }] : [] },
        { name: 'music', count: trackCount, documents: tracks.map(track => ({ _id: String(track._id), catalogId: track.catalogId, title: track.title, artist: track.artistName || 'Community artist', source: track.source, genre: track.genre, uri: track.uri, license: track.license })) },
      ],
    })
  } catch (error) {
    res.status(500).json({ message: 'Could not read database status' })
  }
}

module.exports = { status }

