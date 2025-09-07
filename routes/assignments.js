// routes/assignments.js
const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const ctrl      = require('../controllers/assignment');

router.use(auth);

// student "my assignments" + fetch my own submission
router.get(   '/me',                          authorize('student'),       ctrl.getMyAssignments);
router.get(   '/:id/submission',              authorize('student'),       ctrl.getMySubmission);
router.post(  '/:id/submit',                  authorize('student'),       ctrl.submitAssignment);

// // PDF Download Routes
// ========> NOT IN USE FOR NOW< WILL SEE THIS IN FUTURE  <<<===============
// router.post(  '/download-pdf',                                            ctrl.downloadAssignmentPdf);
// router.post(  '/:id/download-pdf',                                        ctrl.downloadAssignmentPdf);
// router.post(  '/:id/download-pdf/:studentId', authorize('mentor','admin'), ctrl.downloadStudentSubmissionPdf);

// mentor/Admin CRUD & review
router.post(  '/',                            authorize('mentor','admin'), ctrl.createAssignment);
router.get(   '/',                            authorize('mentor','admin'), ctrl.getAssignments);
router.get(   '/:id',                         ctrl.getAssignment);
router.put(   '/:id/dispatch',                authorize('mentor','admin'), ctrl.dispatchAssignment);
router.put(   '/:id/undispatch',              authorize('mentor','admin'), ctrl.undispatchAssignment);
router.put(   '/:id',                         authorize('mentor','admin'), ctrl.updateAssignment);
router.delete('/:id',                         authorize('mentor','admin'), ctrl.deleteAssignment);

// mentor/Admin: list & grade submissions
router.get('/:id/submissions/:studentId/detail', authorize('mentor','admin'), ctrl.getSubmissionDetail);
router.get(   '/:id/submissions/:studentId',  authorize('mentor','admin'), ctrl.getSubmission);
router.put(   '/:id/submissions/:studentId',  authorize('mentor','admin'), ctrl.gradeSubmission);


// Rankings
router.get(   '/:id/rankings',                authorize('mentor','admin'), ctrl.getRankings);

module.exports = router;