const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const authRoutes = require('../routes/auth.routes')
const musicRoutes = require('../routes/music.routes')
const libraryRoutes = require('../routes/library.routes')
const databaseRoutes = require('../routes/database.routes')

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/api/auth', authRoutes)
app.use('/api/music', musicRoutes)
app.use('/api/library', libraryRoutes)
app.use('/api/database', databaseRoutes)
app.use(express.static(path.join(__dirname, '../public')))
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')))

module.exports = app

