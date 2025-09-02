// routes/questions.js
const router       = require('express').Router();
const auth         = require('../middleware/auth');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/question');

// All routes require authentication
router.use(auth);

// Admins & Mentors can create, update, delete
router.post(   '/',               authorize('admin','mentor'), ctrl.createQuestion);
router.put(    '/:id',            authorize('admin','mentor'), ctrl.updateQuestion);
router.delete( '/:id',            authorize('admin','mentor'), ctrl.deleteQuestion);

// Anyone authenticated can read
router.get(    '/',               ctrl.getQuestions);
router.get(    '/:id',            ctrl.getQuestion);


module.exports = router;
