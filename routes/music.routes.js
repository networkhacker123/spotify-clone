const express = require('express')
const multer = require('multer')
const { listMusic, createMusic } = require('../src/controllers/music.controller')
const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

router.get('/', listMusic)
router.post('/', upload.single('audio'), createMusic)

module.exports = router

