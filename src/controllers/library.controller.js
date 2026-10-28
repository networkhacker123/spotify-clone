const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const userModel = require('../models/user.model')
const musicModel = require('../models/music.model')
const local = require('../services/local.service')
const catalog = require('../data/catalog.json')

function currentId(req) {
  const token = req.cookies.token
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET).id } catch (_) { return null }
}

async function getLibrary(req, res) {
  const userId = currentId(req)
  if (!userId) return res.status(401).json({ message: 'Sign in to see your library' })
  try {
    if (process.env.STORAGE_MODE === 'local') return res.json({ savedTracks: local.getSaved(userId) })
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
    const user = await userModel.findById(userId).select('savedTracks')
    if (!user) return res.status(401).json({ message: 'Account not found' })
    res.json({ savedTracks: user.savedTracks || [] })
  } catch (error) {
    res.status(500).json({ message: 'Could not load library' })
  }
}

async function toggleTrack(req, res) {
  const userId = currentId(req)
  if (!userId) return res.status(401).json({ message: 'Sign in to save tracks' })
  const trackId = String(req.params.id || '')
  if (!trackId || trackId.length > 100) return res.status(400).json({ message: 'Invalid track' })
  try {
    if (process.env.STORAGE_MODE === 'local') {
      const exists = catalog.some(track => track.id === trackId) || local.snapshot().tracks.some(track => track.id === trackId)
      if (!exists) return res.status(404).json({ message: 'Track not found' })
      return res.json({ savedTracks: local.toggleSaved(userId, trackId) })
    }
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
    const query = mongoose.isValidObjectId(trackId) ? { $or: [{ catalogId: trackId }, { _id: trackId }] } : { catalogId: trackId }
    if (!await musicModel.exists(query)) return res.status(404).json({ message: 'Track not found' })
    const user = await userModel.findById(userId)
    if (!user) return res.status(401).json({ message: 'Account not found' })
    if (user.savedTracks.includes(trackId)) user.savedTracks = user.savedTracks.filter(id => id !== trackId)
    else user.savedTracks.push(trackId)
    await user.save()
    res.json({ savedTracks: user.savedTracks })
  } catch (error) {
    res.status(500).json({ message: 'Could not update library' })
  }
}

module.exports = { getLibrary, toggleTrack }

