// routes/auth.js - Add resend verification route to your existing routes
const express = require('express')
const router = express.Router()
const {
  register,
  login,
  verifyEmail,
  resendVerification, // NEW
  forgotPassword,
  resetPassword,
  fetchMe
} = require('../controllers/auth')

const auth = require('../middleware/auth')

// Public routes
router.post('/register', register)
router.post('/login', login)
router.get('/verify/:token', verifyEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)

// NEW: Resend verification email route
router.post('/resend-verification', resendVerification)

// Protected routes
router.get('/me', auth, fetchMe)

module.exports = router