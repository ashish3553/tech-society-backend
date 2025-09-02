// controllers/user.js
const mongoose   = require('mongoose')
const User       = require('../models/User')
const Assignment = require('../models/Assignment')
const Submission = require('../models/Submission')

// GET /api/users/:id  → single student's profile for admin/mentor
exports.getStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.params.id

    // Guard against bad ObjectId strings
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' })
    }

    // Basic user info
    const user = await User.findById(studentId)
      .select('name email branch year role')
      .lean()
    if (!user) {
      return res.status(404).json({ success: false, message: 'Not found' })
    }

    // Completed submissions (finalized)
    const completedSubsRaw = await Submission.find({
      student: studentId,
      isFinal: true
    })
      .select('assignment grade submittedAt')
      .populate('assignment', 'title') // may be null if assignment was deleted
      .lean()

    // Drop orphan submissions where assignment no longer exists
    const safeSubs = completedSubsRaw.filter(s => s.assignment)

    // Build a fast lookup of finished assignment IDs
    const doneIds = new Set(safeSubs.map(s => String(s.assignment._id)))

    // Ongoing assignments (dispatched + visible to student) that are not yet done
    const allVisible = await Assignment.find({
      $and: [
        { isDispatched: true },
        { $or: [{ visibleToAll: true }, { visibleTo: studentId }] }
      ]
    })
      .select('title dueDate')
      .lean()

    const ongoing = allVisible.filter(a => !doneIds.has(String(a._id)))

    // Response
    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        branch: user.branch,
        year: user.year,
        submissions: safeSubs.map(s => ({
          _id: s._id,
          assignmentId: s.assignment._id,
          assignmentTitle: s.assignment.title,
          grade: s.grade,
          submittedAt: s.submittedAt
        })),
        ongoing: ongoing.map(a => ({
          _id: a._id,
          title: a.title,
          dueDate: a.dueDate
        }))
      }
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/users        → list all active users (admin/mentor)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role')
      .lean()
    res.json({ success: true, data: users })
  } catch (err) {
    next(err)
  }
}

// GET /api/users/by-role?role=student|mentor → list by role + completed counts
exports.getUsersByRole = async (req, res, next) => {
  try {
    const role = req.query.role

    // 1) fetch basic users
    const users = await User.find({ role }).lean()

    // 2) fetch submission counts for these users
    const counts = await Submission.aggregate([
      { $match: { student: { $in: users.map(u => u._id) }, isFinal: true } },
      { $group: { _id: '$student', completed: { $sum: 1 } } }
    ])

    const countMap = new Map(counts.map(c => [c._id.toString(), c.completed]))

    // 3) merge into user objects
    const withCounts = users.map(u => ({
      ...u,
      completedAssignments: countMap.get(u._id.toString()) || 0
    }))

    res.json({ success: true, data: withCounts })
  } catch (err) {
    next(err)
  }
}
