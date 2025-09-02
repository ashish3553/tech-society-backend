const express = require('express')
const router  = express.Router({ mergeParams: true })
const auth    = require('../middleware/auth')
const authorizeRoles = require('../middleware/authorize')

// controllers
const {
  submitAssignment,
  // mentor/admin:
  getSubmissions,
  getSubmission: getOneSubmission,
  gradeSubmission,
  // new for student:
  getMySubmission
} = require('../controllers/assignment')

router.use(auth)

// student can fetch *their own* submission
router.get('/:id/submission', getMySubmission)

// student submit or save draft
router.post('/:id/submit', submitAssignment)

// mentor/admin endpoints
router.get('/:id/submissions', authorizeRoles('mentor','admin'), getSubmissions)
router.get('/:id/submissions/:studentId', authorizeRoles('mentor','admin'), getOneSubmission)
router.put('/:id/submissions/:studentId/grade', authorizeRoles('mentor','admin'), gradeSubmission)

module.exports = router
