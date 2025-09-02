// controllers/admin.js
const User       = require('../models/User')
const Assignment = require('../models/Assignment')
const Submission = require('../models/Submission')

exports.getStats = async (req, res, next) => {
  try {
    const [ totalUsers, totalAssign, totalQuizzes, totalTests ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Assignment.countDocuments({ mode: 'assignment', isDispatched: true }),
      Assignment.countDocuments({ mode: 'quiz',       isDispatched: true }),
      Assignment.countDocuments({ mode: 'test',       isDispatched: true })
    ]);
 
    const pendingReviews = await Submission.countDocuments({
      isFinal: false, 
      'answers.0': { $exists: true }
    });

    res.json({ success:true, data:{ 
      totalUsers,
      totalAssignments: totalAssign,
      totalQuizzes, 
      totalTests,
      pendingReviews
    }});
  } catch(err) { next(err) }
}
