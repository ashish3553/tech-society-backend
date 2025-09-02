const express       = require('express');
const authorize     = require('../middleware/authorize');
const {
  getAllUsers,           // formerly `getUsers`
  getUsersByRole,
  getStudentProfile
} = require('../controllers/user');



const router = express.Router();

// 1️⃣ GET /api/users/           → only admin/mentor can list *all* active users
router.get(
  '/',
  authorize('admin','mentor'),
  getAllUsers
);

// 2️⃣ GET /api/users/by-role    → admin/mentor can list by role + completed counts
router.get(
  '/by-role',
  authorize('admin','mentor'),
  getUsersByRole
);

// 3️⃣ GET /api/users/:id        → view a single student’s profile
router.get(
  '/:id',
  authorize('admin','mentor'), 
  getStudentProfile
);



module.exports = router;
 