// controllers/user.js - Updated to handle both User and Author models
const mongoose = require('mongoose');
const User = require('../models/User');
const Author = require('../models/Author');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

// Helper function to find user in either User or Author model
const findUserById = async (userId) => {
  try {
    // First try User model
    let user = await User.findById(userId).select('-password -verifyToken -resetPasswordToken');
    if (user) {
      return { user, type: 'user' };
    }

    // Then try Author model
    const author = await Author.findById(userId);
    if (author && author.isActive && author.invitation.status === 'accepted') {
      // Create user-like object from author
      const authorAsUser = {
        _id: author._id,
        name: author.profile.name,
        email: author.profile.email,
        role: 'author',
        isVerified: author.authCredentials?.isVerified || true,
        isUIETHStudent: false, // Authors are not UIETH students by default
        createdAt: author.createdAt,
        updatedAt: author.updatedAt
      };
      return { user: authorAsUser, type: 'author', authorData: author };
    }

    return null;
  } catch (error) {
    console.error('Error in findUserById:', error);
    return null;
  }
};

// GET /api/users/profile - Get current user's profile
const getUserProfile = async (req, res, next) => {
  try {
    const result = await findUserById(req.user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For author-only accounts, include author-specific data
    const responseData = {
      ...result.user,
      ...(result.authorData && {
        authorProfile: {
          bio: result.authorData.profile.bio,
          verified: result.authorData.profile.verified,
          permissions: result.authorData.permissions
        }
      })
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/profile - Update current user's profile
const updateUserProfile = async (req, res, next) => {
  try {
    const result = await findUserById(req.user.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (result.type === 'author') {
      // For author-only accounts, update Author model
      const allowedUpdates = ['name'];
      const updates = {};
      
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[`profile.${key}`] = req.body[key];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update for author accounts'
        });
      }

      const updatedAuthor = await Author.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
      );

      const updatedUser = {
        _id: updatedAuthor._id,
        name: updatedAuthor.profile.name,
        email: updatedAuthor.profile.email,
        role: 'author',
        isVerified: updatedAuthor.authCredentials?.isVerified || true,
        isUIETHStudent: false
      };

      return res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    }

    // For regular users, update User model
    const allowedUpdates = ['name', 'branch', 'year', 'rollNumber'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Validate roll number if provided and user is UIETH student
    if (updates.rollNumber && result.user.isUIETHStudent) {
      if (!/^SG2\d{4}$/.test(updates.rollNumber) || parseInt(updates.rollNumber.slice(-2)) >= 80) {
        return res.status(400).json({
          success: false,
          message: 'Invalid roll number format'
        });
      }
      
      // Check if roll number already exists
      const existingUser = await User.findOne({ 
        rollNumber: updates.rollNumber,
        _id: { $ne: req.user.id }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -verifyToken -resetPasswordToken');

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:id - Get student profile (for mentors/admins)
const getStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user id' 
      });
    }

    // Only look in User model for student profiles (authors don't have academic data)
    const user = await User.findById(studentId)
      .select('name email branch year role isUIETHStudent rollNumber')
      .lean();
      
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Get academic data only for UIETH students
    let submissions = [];
    let ongoing = [];
    
    if (user.isUIETHStudent) {
      // Completed submissions
      const completedSubsRaw = await Submission.find({
        student: studentId,
        isFinal: true
      })
        .select('assignment grade submittedAt')
        .populate('assignment', 'title')
        .lean();

      submissions = completedSubsRaw.filter(s => s.assignment);
      const doneIds = new Set(submissions.map(s => String(s.assignment._id)));

      // Ongoing assignments
      const allVisible = await Assignment.find({
        $and: [
          { isDispatched: true },
          { $or: [{ visibleToAll: true }, { visibleTo: studentId }] }
        ]
      })
        .select('title dueDate')
        .lean();

      ongoing = allVisible.filter(a => !doneIds.has(String(a._id)));
    }

    res.json({
      success: true,
      data: {
        ...user,
        submissions: submissions.map(s => ({
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
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users - Get all users (admin/mentor)
const getAllUsers = async (req, res, next) => {
  try {
    // Get users from User model
    const users = await User.find({ isBanned: { $ne: true } })
      .select('name email role isUIETHStudent branch year')
      .lean();

    // Get active authors
    const authors = await Author.find({ 
      isActive: true,
      'invitation.status': 'accepted',
      userId: null // Only author-only accounts
    })
      .select('profile.name profile.email profile.verified')
      .lean();

    // Convert authors to user-like format
    const authorUsers = authors.map(author => ({
      _id: author._id,
      name: author.profile.name,
      email: author.profile.email,
      role: 'author',
      isUIETHStudent: false,
      accountType: 'author-only'
    }));

    // Combine and mark account types
    const allUsers = [
      ...users.map(user => ({ ...user, accountType: 'regular' })),
      ...authorUsers
    ];

    res.json({ 
      success: true, 
      data: allUsers 
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/by-role - Get users by role with completion stats
const getUsersByRole = async (req, res, next) => {
  try {
    const role = req.query.role;

    if (role === 'author') {
      // Get author-only accounts
      const authors = await Author.find({ 
        isActive: true,
        'invitation.status': 'accepted'
      })
        .select('profile.name profile.email userId analytics')
        .lean();

      const authorUsers = authors.map(author => ({
        _id: author._id,
        name: author.profile.name,
        email: author.profile.email,
        role: 'author',
        isUIETHStudent: false,
        accountType: author.userId ? 'combined' : 'author-only',
        completedArticles: author.analytics?.publishedArticles || 0
      }));

      return res.json({ 
        success: true, 
        data: authorUsers 
      });
    }

    // Get regular users by role
    const users = await User.find({ role, isBanned: { $ne: true } }).lean();

    // Get submission counts for UIETH students only
    let usersWithCounts = users;
    if (role === 'student') {
      const uiethStudents = users.filter(u => u.isUIETHStudent);
      const uiethStudentIds = uiethStudents.map(u => u._id);
      
      if (uiethStudentIds.length > 0) {
        const counts = await Submission.aggregate([
          { $match: { student: { $in: uiethStudentIds }, isFinal: true } },
          { $group: { _id: '$student', completed: { $sum: 1 } } }
        ]);

        const countMap = new Map(counts.map(c => [c._id.toString(), c.completed]));

        usersWithCounts = users.map(u => ({
          ...u,
          completedAssignments: u.isUIETHStudent ? (countMap.get(u._id.toString()) || 0) : 0
        }));
      } else {
        usersWithCounts = users.map(u => ({
          ...u,
          completedAssignments: 0
        }));
      }
    }

    res.json({ 
      success: true, 
      data: usersWithCounts 
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id/ban - Ban user (Admin only)
const banUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Ban reason is required'
      });
    }

    // Try to find and ban in User model first
    let user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: req.user.id,
        banReason: reason
      },
      { new: true }
    ).select('-password');

    if (user) {
      return res.json({
        success: true,
        data: user,
        message: 'User banned successfully'
      });
    }

    // If not found in User model, try Author model
    const author = await Author.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: req.user.id,
        deactivationReason: reason
      },
      { new: true }
    );

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: author._id,
        name: author.profile.name,
        email: author.profile.email,
        isBanned: true,
        bannedAt: author.deactivatedAt,
        banReason: reason
      },
      message: 'Author account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/:id/unban - Unban user (Admin only)
const unbanUser = async (req, res, next) => {
  try {
    // Try User model first
    let user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
        banReason: null
      },
      { new: true }
    ).select('-password');

    if (user) {
      return res.json({
        success: true,
        data: user,
        message: 'User unbanned successfully'
      });
    }

    // Try Author model
    const author = await Author.findByIdAndUpdate(
      req.params.id,
      {
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null
      },
      { new: true }
    );

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: author._id,
        name: author.profile.name,
        email: author.profile.email,
        isBanned: false
      },
      message: 'Author account reactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Export all functions
module.exports = {
  getUserProfile,
  updateUserProfile,
  getStudentProfile,
  getAllUsers,
  getUsersByRole,
  banUser,
  unbanUser
};