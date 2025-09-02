// routes/stats.js
const router      = require('express').Router()
const auth        = require('../middleware/auth')
const authorize   = require('../middleware/authorize')
const stats       = require('../controllers/stats')

// 1️⃣ Simple totals (students, mentors, live assignments/quizzes/tests, ongoing, pending review)
router.get(
  '/',
  auth,
  authorize('mentor','admin'),
  stats.getStats
)

// 2️⃣ Rich dashboard stats (leaderboards, dispatched vs. drafts per mode)
router.get(
  '/dashboard',
  auth,
  authorize('mentor','admin'),
  stats.getDashboardStats
)

module.exports = router
