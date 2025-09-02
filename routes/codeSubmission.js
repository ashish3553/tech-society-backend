// routes/codeSubmission.js - Updated routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const codeSubmissionController = require('../controllers/codeSubmissionController');

// All routes require authentication
router.use(auth);

// Student routes
router.post('/code-submissions', codeSubmissionController.submitCode);
router.post('/code-submissions/draft', codeSubmissionController.saveDraft);
router.get('/code-submissions', codeSubmissionController.getSubmissions);

// Instructor routes for manual grading
router.put('/code-submissions/:submissionId/grade', 
  authorize('admin', 'mentor'), 
  codeSubmissionController.gradeSubmission
);

// Get submissions for grading (admin/mentor only)
router.get('/code-submissions/grading',
  authorize('admin', 'mentor'),
  async (req, res, next) => {
    try {
      const { assignmentId, questionId } = req.query;
      
      const submissions = await require('../models/CodeSubmission')
        .find({
          assignment: assignmentId,
          question: questionId,
          isDraft: false
        })
        .populate('student', 'name email')
        .populate('question', 'content')
        .sort({ submittedAt: -1 });

      res.json({
        success: true,
        data: submissions
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;