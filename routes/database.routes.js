const express = require('express')
const { status } = require('../src/controllers/database.controller')
const router = express.Router()

router.get('/', status)

module.exports = router

