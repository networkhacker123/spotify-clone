const mongoose = require('mongoose')

const musicSchema = new mongoose.Schema({
  catalogId: { type: String, unique: true, sparse: true },
  uri: { type: String, required: true },
  title: { type: String, required: true },
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  artistName: String,
  source: { type: String, enum: ['catalog', 'upload'], default: 'upload' },
  genre: String,
  duration: Number,
  colors: [String],
  license: String,
})

module.exports = mongoose.model('music', musicSchema)

