const express = require('express')
const { getLibrary, toggleTrack } = require('../src/controllers/library.controller')
const router = express.Router()

router.get('/', getLibrary)
router.put('/:id', toggleTrack)

module.exports = router

