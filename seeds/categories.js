// CRITICAL FIX: Backend Route Conflicts
// The issue is conflicting routes. Your existing article routes might be interfering.

// ==========================================
// 1. FIXED CATEGORY ROUTES (routes/categories.js)
// ==========================================
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Import controller (make sure this path is correct)
const {
  getCategoryTree,
  getFlattenedCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCategoryWithBreadcrumb,
  getCategoriesByLevel,
  getAllCategories // Add this for simple list
} = require('../controllers/categoryController');

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================
router.get('/', getAllCategories); // Simple list - FIXED ROUTE
router.get('/tree', getCategoryTree); // Hierarchical tree
router.get('/flat', getFlattenedCategories); // Flattened for dropdowns
router.get('/level', getCategoriesByLevel); // By level
router.get('/:id/breadcrumb', getCategoryWithBreadcrumb); // With breadcrumb

// ==========================================
// PROTECTED ROUTES (Auth Required)
// ==========================================
router.post('/', auth, authorize('admin', 'mentor'), createCategory);
router.put('/:id', auth, authorize('admin'), updateCategory); // ADMIN ONLY for updates
router.delete('/:id', auth, authorize('admin'), deleteCategory); // ADMIN ONLY for deletion
router.put('/reorder', auth, authorize('admin'), reorderCategories); // ADMIN ONLY for reorder

module.exports = router;

// ==========================================
// 2. FIXED CATEGORY CONTROLLER ADDITIONS
// ==========================================

// Add this method to your categoryController.js
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await ArticleCategory.find({ isVisible: true })
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .populate('parentCategory', 'name slug color')
      .select('name slug description icon color parentCategory level isFolder articleCount');

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. SERVER INTEGRATION FIX
// ==========================================
// In your main server file (index.js or app.js), ensure proper mounting:

// IMPORTANT: Mount category routes BEFORE article routes to avoid conflicts
app.use('/api/categories', require('./routes/categories')); // Changed from /api/articles/categories
app.use('/api/articles', require('./routes/articles')); // Your existing article routes

// OR if you want to keep the existing structure:
app.use('/api/articles/categories', require('./routes/categories'));
// BUT make sure your article routes don't have a conflicting catch-all route

// ==========================================
// 4. ENHANCED CATEGORY CONTROLLER FIXES
// ==========================================

// Fix the createCategory method to handle hierarchy properly
exports.createCategory = async (req, res, next) => {
  try {
    const {
      name,
      description,
      icon,
      color,
      parentCategory,
      isFolder,
      sortOrder
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Validate parent category exists if specified
    if (parentCategory) {
      const parent = await ArticleCategory.findById(parentCategory);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }

      // Prevent deep nesting (max 3 levels: 0, 1, 2)
      if (parent.level >= 2) {
        return res.status(400).json({
          success: false,
          message: 'Maximum category depth of 3 levels allowed'
        });
      }
    }

    // Check for duplicate names at the same level
    const existingCategory = await ArticleCategory.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      parentCategory: parentCategory || null
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists at this level'
      });
    }

    // Get the next sort order for this level
    const maxSortOrder = await ArticleCategory.findOne({
      parentCategory: parentCategory || null
    }).sort({ sortOrder: -1 }).select('sortOrder');

    const category = new ArticleCategory({
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon?.trim() || '',
      color: color || '#6366f1',
      parentCategory: parentCategory || null,
      isFolder: Boolean(isFolder),
      sortOrder: sortOrder || (maxSortOrder ? maxSortOrder.sortOrder + 1 : 0),
      createdBy: req.user.id
    });

    await category.save();

    // Populate for response
    await category.populate('parentCategory', 'name slug color');

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Create category error:', error);
    next(error);
  }
};

// ==========================================
// 5. ARTICLE MODEL INTEGRATION FIX
// ==========================================
// Make sure your Article model references the category correctly:

// In your Article schema, ensure the category field is properly defined:
const ArticleSchema = new mongoose.Schema({
  // ... other fields
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ArticleCategory', // Make sure this matches your model name
    required: true 
  },
  // ... other fields
});

// ==========================================
// 6. MIDDLEWARE ERROR HANDLING
// ==========================================
// Add this to your error handling middleware:

// In your error handling middleware (usually at the end of your routes):
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  
  // Handle validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages
    });
  }

  // Handle duplicate key errors
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry found'
    });
  }

  // Handle cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// ==========================================
// 7. DATABASE SEEDER FOR DEFAULT CATEGORIES
// ==========================================
// Create this file: seeds/categories.js
const ArticleCategory = require('../models/ArticleCategory');

const defaultCategories = [
  {
    name: 'Programming',
    description: 'Programming languages and concepts',
    icon: 'code',
    color: '#3b82f6',
    isFolder: true,
    children: [
      {
        name: 'JavaScript',
        description: 'JavaScript tutorials and examples',
        icon: 'code',
        color: '#f59e0b'
      },
      {
        name: 'Python',
        description: 'Python programming',
        icon: 'code',
        color: '#10b981'
      }
    ]
  },
  {
    name: 'Data Structures',
    description: 'Data structures and algorithms',
    icon: 'database',
    color: '#8b5cf6',
    isFolder: true,
    children: [
      {
        name: 'Arrays',
        description: 'Array data structure',
        icon: 'grid',
        color: '#ec4899'
      },
      {
        name: 'Linked Lists',
        description: 'Linked list implementations',
        icon: 'link',
        color: '#06b6d4'
      }
    ]
  }
];

async function seedCategories() {
  try {
    // Clear existing categories (optional)
    // await ArticleCategory.deleteMany({});

    for (const categoryData of defaultCategories) {
      const { children, ...parentData } = categoryData;
      
      // Create parent category
      const parent = await ArticleCategory.create({
        ...parentData,
        createdBy: '60d5f7f5f5f5f5f5f5f5f5f5' // Replace with actual admin user ID
      });

      // Create children
      if (children && children.length > 0) {
        for (let i = 0; i < children.length; i++) {
          await ArticleCategory.create({
            ...children[i],
            parentCategory: parent._id,
            sortOrder: i,
            createdBy: '60d5f7f5f5f5f5f5f5f5f5f5' // Replace with actual admin user ID
          });
        }
      }
    }

    console.log('Categories seeded successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
  }
}

module.exports = seedCategories;

// Run this seeder: node seeds/categories.js