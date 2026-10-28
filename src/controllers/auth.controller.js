const mongoose = require('mongoose')
const userModel = require('../models/user.model')
const local = require('../services/local.service')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const useLocal = () => process.env.STORAGE_MODE === 'local'

function publicUser(user) {
  return { id: user.id || user._id, username: user.username, email: user.email, role: user.role }
}

function setSession(res, user) {
  const token = jwt.sign({ id: user.id || user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 })
}

async function registerUser(req, res) {
  const username = String(req.body.username || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const role = req.body.role === 'artist' ? 'artist' : 'user'
  if (!username || !email || password.length < 6) {
    return res.status(400).json({ message: 'Enter a name, email, and password of at least 6 characters' })
  }

  if (!useLocal() && mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
  try {
    const exists = useLocal()
      ? local.findUser(username) || local.findUser(email)
      : await userModel.findOne({ $or: [{ username }, { email }] })
    if (exists) return res.status(409).json({ message: 'Username or email is already in use' })
    const hash = await bcrypt.hash(password, 10)
    const user = useLocal()
      ? local.createUser({ username, email, password: hash, role })
      : await userModel.create({ username, email, password: hash, role })
    setSession(res, user)
    res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    res.status(500).json({ message: 'Could not create account' })
  }
}

async function loginUser(req, res) {
  const identity = String(req.body.identity || req.body.username || req.body.email || '').trim()
  const password = String(req.body.password || '')
  if (!identity || !password) return res.status(400).json({ message: 'Enter your username or email and password' })

  if (!useLocal() && mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'MongoDB is not connected' })
  try {
    const user = useLocal()
      ? local.findUser(identity)
      : await userModel.findOne({ $or: [{ username: identity }, { email: identity.toLowerCase() }] })
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    setSession(res, user)
    res.json({ user: publicUser(user) })
  } catch (error) {
    res.status(500).json({ message: 'Could not sign in' })
  }
}

async function currentUser(req, res) {
  try {
    const token = req.cookies.token
    if (!token) return res.json({ user: null })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = useLocal() ? local.findUserById(payload.id) : await userModel.findById(payload.id)
    res.json({ user: user ? publicUser(user) : null })
  } catch (error) {
    res.json({ user: null })
  }
}

function logoutUser(req, res) {
  res.clearCookie('token')
  res.json({ message: 'Signed out' })
}

module.exports = { registerUser, loginUser, currentUser, logoutUser }


