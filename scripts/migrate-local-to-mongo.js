require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const connectDB = require('../db/db')
const User = require('../src/models/user.model')
const Music = require('../src/models/music.model')

async function main() {
  const source = path.join(__dirname, '..', 'data', 'store.json')
  if (!fs.existsSync(source)) {
    console.log('No local data to migrate')
    return
  }
  const local = JSON.parse(fs.readFileSync(source, 'utf8'))
  if (!await connectDB()) throw new Error('MongoDB connection failed; local data was not changed')

  const users = new Map()
  for (const item of local.users || []) {
    let user = await User.findOne({ email: item.email })
    if (!user) {
      user = await User.create({
        username: item.username,
        email: item.email,
        password: item.password,
        role: item.role,
        savedTracks: [],
      })
    }
    users.set(item.id, user)
  }

  const uploadedIds = new Map()
  for (const item of local.tracks || []) {
    let track = await Music.findOne({ uri: item.uri })
    if (!track) {
      track = await Music.create({
        title: item.title,
        uri: item.uri,
        artist: users.get(item.artistId)?._id,
        artistName: users.get(item.artistId)?.username || 'Unknown artist',
        source: 'upload',
        genre: 'Community',
      })
    }
    uploadedIds.set(item.id, String(track._id))
  }

  for (const item of local.users || []) {
    const user = users.get(item.id)
    const saved = (item.savedTracks || []).map(id => uploadedIds.get(id) || id)
    user.savedTracks = [...new Set([...(user.savedTracks || []), ...saved])]
    await user.save()
  }

  console.log('Migrated ' + users.size + ' local account(s), ' + uploadedIds.size + ' upload(s), and saved-song lists')
  console.log('Local data/store.json remains untouched')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())

