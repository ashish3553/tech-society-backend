const express = require('express');
const authorize = require('../middleware/authorize');
const auth = require('../middleware/auth');
const {
  getAllUsers,
  getUsersByRole,
  getStudentProfile,
  getUserProfile,
  updateUserProfile,
  banUser,
  unbanUser
} = require('../controllers/user');

const router = express.Router();

// User profile routes
router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, updateUserProfile);

// Admin user management
router.get('/', authorize('admin','mentor'), getAllUsers);
router.get('/by-role', authorize('admin','mentor'), getUsersByRole);
router.get('/:id', authorize('admin','mentor'), getStudentProfile);
router.put('/:id/ban', auth, authorize('admin'), banUser);
router.put('/:id/unban', auth, authorize('admin'), unbanUser);

module.exports = router;