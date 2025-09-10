// routes/categories.js - FIXED WITH PROPER CORS HANDLING
const express = require('express');
const router = express.Router();
const cors = require('cors');

// Import middleware
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Import controller functions
const {
  getCategoryTree,
  getFlattenedCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCategoryWithBreadcrumb,
  getCategoriesByLevel,
  getAllCategories
} = require('../controllers/categoryController');

// CORS configuration for category routes
const corsOptions = {
  origin: [
    'https://practicearenauieth.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000' // Add localhost for testing
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Apply CORS to all category routes
router.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
router.options('*', cors(corsOptions));

// Add debugging middleware
router.use((req, res, next) => {
  console.log(`🔍 Category Route: ${req.method} ${req.originalUrl}`);
  console.log(`🔍 Headers:`, {
    origin: req.headers.origin,
    'content-type': req.headers['content-type'],
    authorization: req.headers.authorization ? 'Present' : 'None'
  });
  next();
});

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================

// GET /api/categories - Simple list of all categories
router.get('/', getAllCategories);

// GET /api/categories/tree - Hierarchical tree structure  
router.get('/tree', getCategoryTree);

// GET /api/categories/flat - Flattened for dropdowns
router.get('/flat', getFlattenedCategories);

// GET /api/categories/level - Categories by level
router.get('/level', getCategoriesByLevel);

// GET /api/categories/:id/breadcrumb - Category with breadcrumb
router.get('/:id/breadcrumb', getCategoryWithBreadcrumb);

// ==========================================
// PROTECTED ROUTES (Auth Required)
// ==========================================

// POST /api/categories - Create new category
router.post('/', auth, authorize('admin', 'mentor','author'), createCategory);

// PUT /api/categories/:id - Update category  
router.put('/:id', auth, authorize('admin','mentor','author'), updateCategory);

// DELETE /api/categories/:id - Delete category
router.delete('/:id', auth, authorize('admin'), deleteCategory);

// PUT /api/categories/reorder - Reorder categories
router.put('/reorder', auth, authorize('admin'), reorderCategories);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('❌ Category Router Error:', {
    error: error.message,
    method: req.method,
    url: req.originalUrl,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
  
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

module.exports = router;