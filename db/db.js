const mongoose = require('mongoose')
const dns = require('dns')
const musicModel = require('../src/models/music.model')
const catalog = require('../src/data/catalog.json')

async function connectDB() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing')
    if (process.env.MONGO_URI.startsWith('mongodb+srv://')) {
      const hostname = new URL(process.env.MONGO_URI).hostname
      try {
        await dns.promises.resolveSrv('_mongodb._tcp.' + hostname)
      } catch (error) {
        dns.setServers(['1.1.1.1'])
      }
    }
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
    await Promise.all(catalog.map(track => musicModel.updateOne(
      { catalogId: track.id },
      { $setOnInsert: {
        catalogId: track.id,
        title: track.title,
        uri: track.uri,
        artistName: track.artist,
        source: 'catalog',
        genre: track.genre,
        duration: track.duration,
        colors: track.colors,
        license: track.license,
      } },
      { upsert: true }
    )))
    console.log('MongoDB connected and starter catalog synced')
    return true
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    return false
  }
}

module.exports = connectDB

