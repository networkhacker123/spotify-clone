const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const dataDir = path.join(__dirname, '../../data')
const dataFile = path.join(dataDir, 'store.json')
const uploadDir = path.join(__dirname, '../../public/uploads')

function readStore() {
  fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(dataFile)) return { users: [], tracks: [] }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'))
}

function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true })
  const temporary = dataFile + '.tmp'
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2))
  fs.renameSync(temporary, dataFile)
}

function findUser(identity) {
  const key = identity.toLowerCase()
  return readStore().users.find(user => user.username.toLowerCase() === key || user.email.toLowerCase() === key) || null
}

function findUserById(id) {
  return readStore().users.find(user => user.id === id) || null
}

function createUser({ username, email, password, role }) {
  const store = readStore()
  const user = { id: crypto.randomUUID(), username, email, password, role }
  store.users.push(user)
  writeStore(store)
  return user
}

function listTracks() {
  const store = readStore()
  return store.tracks.slice().reverse().map(track => ({
    id: track.id,
    title: track.title,
    uri: track.uri,
    artist: store.users.find(user => user.id === track.artistId)?.username || 'Unknown artist',
  }))
}

function saveTrack({ title, artistId, file }) {
  fs.mkdirSync(uploadDir, { recursive: true })
  const extensions = { 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/webm': '.webm', 'audio/flac': '.flac' }
  const extension = extensions[file.mimetype] || '.audio'
  const filename = crypto.randomUUID() + extension
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer)
  const store = readStore()
  const track = { id: crypto.randomUUID(), title, uri: '/uploads/' + filename, artistId }
  store.tracks.push(track)
  writeStore(store)
  return { id: track.id, title: track.title, uri: track.uri }
}

function getSaved(userId) {
  return findUserById(userId)?.savedTracks || []
}

function toggleSaved(userId, trackId) {
  const store = readStore()
  const user = store.users.find(item => item.id === userId)
  if (!user) throw new Error('Account not found')
  user.savedTracks ||= []
  if (user.savedTracks.includes(trackId)) user.savedTracks = user.savedTracks.filter(id => id !== trackId)
  else user.savedTracks.push(trackId)
  writeStore(store)
  return user.savedTracks
}

function snapshot() {
  const store = readStore()
  return {
    users: store.users.map(user => ({ id: user.id, username: user.username, role: user.role, savedTracks: user.savedTracks || [] })),
    tracks: store.tracks.map(track => ({ id: track.id, title: track.title, uri: track.uri, artistId: track.artistId, source: 'upload' })),
  }
}

module.exports = { findUser, findUserById, createUser, listTracks, saveTrack, getSaved, toggleSaved, snapshot }


