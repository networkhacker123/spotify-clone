const express = require('express')
const auth = require('../src/controllers/auth.controller')
const router = express.Router()

router.post('/register', auth.registerUser)
router.post('/login', auth.loginUser)
router.get('/me', auth.currentUser)
router.post('/logout', auth.logoutUser)

module.exports = router

