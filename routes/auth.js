const express = require('express')
const router  = express.Router()
const { register, verifyEmail, login, forgotPassword, resetPassword, fetchMe } = require('../controllers/auth')
const auth    = require('../middleware/auth')

router.post('/register',    register)
router.get ('/verify/:token',verifyEmail)
router.post('/login',       login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)
router.get ('/me', auth, fetchMe)

module.exports = router
