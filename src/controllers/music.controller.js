const mongoose = require('mongoose')
const musicModel = require('../models/music.model')
const local = require('../services/local.service')
const catalog = require('../data/catalog.json')
const jwt = require('jsonwebtoken')
const { uploadFile } = require('../services/storage.service')

const useLocal = () => process.env.STORAGE_MODE === 'local'

async function listMusic(req, res) {
  try {
    if (useLocal()) {
      return res.json({ tracks: [...catalog, ...local.listTracks().map(track => ({ ...track, source: 'upload', genre: 'Community', colors: ['#2b6652', '#96be50'] }))] })
    }
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
    const tracks = await musicModel.find().populate('artist', 'username').sort({ source: 1, _id: -1 }).lean()
    res.json({ tracks: tracks.map(track => ({
      id: track.catalogId || String(track._id),
      title: track.title,
      uri: track.uri,
      artist: track.artist?.username || track.artistName || 'Unknown artist',
      source: track.source || 'upload',
      genre: track.genre || 'Community',
      duration: track.duration || null,
      colors: track.colors?.length ? track.colors : ['#2b6652', '#96be50'],
      license: track.license || null,
    })) })
  } catch (error) {
    res.status(500).json({ message: 'Could not load music' })
  }
}

async function createMusic(req, res) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ message: 'Sign in to upload music' })

  let user
  try {
    user = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(401).json({ message: 'Your session has expired' })
  }
  if (user.role !== 'artist') return res.status(403).json({ message: 'Artist account required' })

  const title = String(req.body.title || '').trim()
  if (!title || !req.file) return res.status(400).json({ message: 'A title and audio file are required' })
  if (!req.file.mimetype.startsWith('audio/')) return res.status(400).json({ message: 'Choose an audio file' })

  try {
    if (useLocal()) {
      const track = local.saveTrack({ title, artistId: user.id, file: req.file })
      return res.status(201).json({ track })
    }
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
    const uploaded = await uploadFile(req.file.buffer.toString('base64'), req.file.originalname)
    const track = await musicModel.create({ title, uri: uploaded.url, artist: user.id, source: 'upload', genre: 'Community' })
    res.status(201).json({ track: { id: track._id, title: track.title, uri: track.uri } })
  } catch (error) {
    res.status(500).json({ message: 'Upload failed. Please try again.' })
  }
}

module.exports = { listMusic, createMusic }

