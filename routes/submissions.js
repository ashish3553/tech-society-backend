// routes/submission.js - FIXED with detail endpoint

const express = require('express')
const router  = express.Router({ mergeParams: true })
const auth    = require('../middleware/auth')
const authorizeRoles = require('../middleware/authorize')

// controllers
const {
  submitAssignment,
  // mentor/admin:
  getSubmissions,
  getSubmission,
  getSubmissionDetail, // NEW: Add the detail endpoint
  gradeSubmission,
  // student:
  getMySubmission
} = require('../controllers/assignment')

router.use(auth)

// Student routes
router.get('/:id/submission', getMySubmission)
router.post('/:id/submit', submitAssignment)

// Mentor/Admin routes
router.get('/:id/submissions', authorizeRoles('mentor','admin'), getSubmissions)

// FIXED: Add the missing detail endpoint
router.get('/:id/submissions/:studentId/detail', authorizeRoles('mentor','admin'), getSubmissionDetail)

// Basic submission endpoint (fallback)
router.get('/:id/submissions/:studentId', authorizeRoles('mentor','admin'), getSubmission)

// Grading endpoint
router.put('/:id/submissions/:studentId/grade', authorizeRoles('mentor','admin'), gradeSubmission)

module.exports = router