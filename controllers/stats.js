// controllers/stats.js
const User       = require('../models/User')
const Assignment = require('../models/Assignment')
const Submission = require('../models/Submission')
const Question   = require('../models/Question')

exports.getDashboardStats = async (req, res, next) => {
  try {
    // Only for mentor/admin
    if (!['mentor','admin'].includes(req.user.role)) {
      return res.status(403).json({ success:false })
    }

    // 1) Global counts
    const [
      totalStudents,
      totalAssignments,
      totalQuizzes,
      totalTests,
      totalQuestions,
      mcqCount,
      msqCount,
      descriptiveCount,
      imageCount
    ] = await Promise.all([
      User.countDocuments({ role:'student' }),
      Assignment.countDocuments({ mode:'assignment' }),
      Assignment.countDocuments({ mode:'quiz' }),
      Assignment.countDocuments({ mode:'test' }),
      Question.countDocuments(),
      Question.countDocuments({ type:'mcq' }),
      Question.countDocuments({ type:'msq' }),
      Question.countDocuments({ type:'descriptive' }),
      Question.countDocuments({ type:'image' })
    ])

    // 2) Dispatched vs drafts per mode
    const dispatched = await Assignment.aggregate([
      { $group: {
          _id: '$mode',
          dispatched: { $sum: { $cond: ['$isDispatched',1,0] } },
          drafts:      { $sum: { $cond: ['$isDispatched',0,1] } }
      }}
    ])

    // 3) Leaderboards: quizzes/tests with student info
    const leaderboard = await Submission.aggregate([
      { $match: { grade: { $ne: null } }},
      { $lookup: {
          from: 'assignments',
          localField: 'assignment',
          foreignField: '_id',
          as: 'assignment'
      }},
      { $unwind: '$assignment' },
      { $match: { 'assignment.mode': { $in: ['quiz','test'] } }},
      { $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'student'
      }},
      { $unwind: '$student' },
      { $group: {
          _id: '$assignment._id',
          title: { $first: '$assignment.title' },
          scores: {
            $push: {
              student: {
                _id:   '$student._id',
                name:  '$student.name',
                email: '$student.email'
              },
              grade: '$grade'
            }
          }
      }},
      { $project: {
          title: 1,
          leaderboard: {
            $slice: [
              { $sortArray: { input: '$scores', sortBy: { grade:-1 } } },
              5
            ]
          }
      }}
    ])

    return res.json({
      success: true,
      data: {
        totalStudents,
        totalAssignments,
        totalQuizzes,
        totalTests,
        // new question stats
        totalQuestions,
        mcqCount,
        msqCount,
        descriptiveCount,
        imageCount,
        dispatched,
        leaderboard
      }
    })
  } catch(err) {
    next(err)
  }
}



exports.getStats = async (req, res, next) => {
  try {
    // counts by role
    const [ totalStudents, totalMentors ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'mentor' })
    ])

    // assignments / quizzes / tests (dispatched only)
    const [ totalAssignments, totalQuizzes, totalTests ] = await Promise.all([
      Assignment.countDocuments({ mode: 'assignment', isDispatched: true }),
      Assignment.countDocuments({ mode: 'quiz',       isDispatched: true }),
      Assignment.countDocuments({ mode: 'test',       isDispatched: true })
    ])

    // total questions in question bank
    const totalQuestions = await Question.countDocuments()

    // ongoing (dispatched & not yet due)
    const now = new Date()
    const [ ongoingAssignments, ongoingQuizzes, ongoingTests ] = await Promise.all([
      Assignment.countDocuments({ mode:'assignment', isDispatched:true, dueDate:{ $gt: now } }),
      Assignment.countDocuments({ mode:'quiz',       isDispatched:true, dueDate:{ $gt: now } }),
      Assignment.countDocuments({ mode:'test',       isDispatched:true, dueDate:{ $gt: now } })
    ])

    // submissions reviewed vs pending manual
    const totalSubs     = await Submission.countDocuments({ isFinal: true })
    const pendingReview = await Submission.countDocuments({
      isFinal: true,
      feedback: null,
      'answers.isCorrect': { $exists: false }
    })

    res.json({
      success: true,
      data: {
        totalStudents,
        totalMentors,
        totalAssignments,
        totalQuizzes,
        totalTests,
        totalQuestions,
        ongoingAssignments,
        ongoingQuizzes,
        ongoingTests,
        totalSubs,
        pendingReview
      }
    })
  } catch (err) {
    next(err)
  }
}