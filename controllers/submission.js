const Assignment         = require('../models/Assignment');
const Question           = require('../models/Question');
const Submission         = require('../models/Submission');
const generateSubmissionPDF = require('../utils/pdfGenerator');

// POST /api/assignments/:id/submit
exports.submitAssignment = async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    const userId       = req.user.id;
    const { answers }  = req.body;

    // 1. Validate assignment exists & visibility
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success:false, message:'Assignment not found' });
    }
    if (
      req.user.role === 'student' &&
      !assignment.visibleToAll &&
      !assignment.visibleTo.map(id => id.toString()).includes(userId)
    ) {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }

    // 2. Auto-grade
    let totalScore = 0;
    const gradedAnswers = await Promise.all(answers.map(async (ans) => {
      const q = await Question.findById(ans.questionId);
      if (!q) throw new Error(`Question ${ans.questionId} not found`);

      let isCorrect = false, score = 0;

      if (['mcq','msq'].includes(q.type)) {
        const correct = q.correctAnswers;
        const userAns = Array.isArray(ans.answer) ? ans.answer : [ans.answer];

        if (q.type === 'mcq') {
          isCorrect = userAns.length === 1 && userAns[0] === correct[0];
        } else { // msq
          isCorrect =
            userAns.length === correct.length &&
            userAns.every(opt => correct.includes(opt));
        }
        score = isCorrect ? 1 : 0;
      }
      // descriptive/image → leave isCorrect=false, score=0

      totalScore += score;
      return {
        question:  q._id,
        answer:    ans.answer,
        isCorrect, score
      };
    }));

    // 3. Save submission
    const submission = await Submission.create({
      assignment: assignmentId,
      student:    userId,
      answers:    gradedAnswers,
      totalScore
    });

    res.status(201).json({ success:true, data: submission });
  } catch (err) {
    next(err);
  }
};

// GET /api/assignments/:id/submissions
exports.getSubmissions = async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    const filter = { assignment: assignmentId };
    if (req.user.role === 'student') filter.student = req.user.id;

    const subs = await Submission.find(filter)
      .populate('student','name email');

    res.json({ success:true, data: subs });
  } catch (err) {
    next(err);
  }
};

// GET /api/assignments/:id/submissions/:sid
exports.getSubmission = async (req, res, next) => {
  try {
    const { id: assignmentId, sid } = req.params;
    const sub = await Submission.findOne({ _id: sid, assignment: assignmentId })
      .populate('student','name email')
      .populate('answers.question','content');

    if (!sub) {
      return res.status(404).json({ success:false, message:'Submission not found' });
    }
    // student may only view own
    if (req.user.role === 'student' && sub.student._id.toString() !== req.user.id) {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }
    res.json({ success:true, data: sub });
  } catch (err) {
    next(err);
  }
};

// GET /api/assignments/:id/submissions/:sid/pdf
exports.downloadSubmission = async (req, res, next) => {
  try {
    const { id: assignmentId, sid } = req.params;
    const [ assignment, sub ] = await Promise.all([
      Assignment.findById(assignmentId),
      Submission.findOne({ _id: sid, assignment: assignmentId })
        .populate('student','name email')
        .populate('answers.question','content')
    ]);

    if (!assignment || !sub) {
      return res.status(404).json({ success:false, message:'Not found' });
    }
    if (
      req.user.role === 'student' &&
      sub.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }

    generateSubmissionPDF(res, sub, assignment);
  } catch (err) {
    next(err);
  }
};
