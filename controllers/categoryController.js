// controllers/categoryController.js - COMPLETE FIXED VERSION
const ArticleCategory = require('../models/ArticleCategory');
const Article = require('../models/Article');





// GET /api/categories - Get all categories (simple list)
exports.getAllCategories = async (req, res, next) => {
  try {
    console.log('📋 Fetching all categories...');
    
    const categories = await ArticleCategory.find({ isVisible: true })
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .populate('parentCategory', 'name slug color')
      .select('name slug description icon color parentCategory level isFolder articleCount')
      .lean();

    console.log(`✅ Found ${categories.length} categories`);

    // Always return success, even if empty
    res.json({
      success: true,
      data: categories,
      count: categories.length,
      message: categories.length === 0 ? 'No categories found' : `Found ${categories.length} categories`
    });
  } catch (error) {
    console.error('❌ Get all categories error:', error);
    next(error);
  }
};

// GET /api/categories/tree - Get category tree (hierarchical structure)
// In controllers/categoryController.js, update getCategoryTree method:
exports.getCategoryTree = async (req, res, next) => {
  try {
    console.log('🌳 Building category tree...');
    
    // Get all categories with article counts
    const Article = require('../models/Article');
    const allCategories = await ArticleCategory.find({ isVisible: true })
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean();

    // Get article counts for each category
    const articleCounts = await Article.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Map counts to categories
    const countMap = {};
    articleCounts.forEach(item => {
      if (item._id) countMap[item._id.toString()] = item.count;
    });

    // Build tree structure recursively with counts
    const buildTree = (parentId = null) => {
      return allCategories
        .filter(cat => {
          if (parentId === null) {
            return !cat.parentCategory || cat.parentCategory === null;
          }
          return cat.parentCategory && cat.parentCategory.toString() === parentId.toString();
        })
        .map(cat => ({
          ...cat,
          articleCount: countMap[cat._id.toString()] || 0,
          children: buildTree(cat._id)
        }));
    };

    const tree = buildTree();
    
    console.log(`✅ Built tree with ${tree.length} root categories`);
    
    res.json({
      success: true,
      data: tree,
      count: tree.length
    });
  } catch (error) {
    console.error('❌ Category Tree Error:', error);
    next(error);
  }
};
// GET /api/categories/flat - Get flattened categories list (for dropdowns)
exports.getFlattenedCategories = async (req, res, next) => {
  try {
    const categories = await ArticleCategory.find({ isVisible: true })
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .populate('parentCategory', 'name')
      .lean();
    
    // Add indentation and breadcrumb info
    const flattened = categories.map(cat => ({
      ...cat,
      indentedName: '  '.repeat(cat.level || 0) + cat.name,
      breadcrumb: cat.level > 0 ? `${cat.parentCategory?.name} > ${cat.name}` : cat.name
    }));
    
    res.json({
      success: true,
      data: flattened,
      count: flattened.length
    });
  } catch (error) {
    console.error('❌ Flattened Categories Error:', error);
    next(error);
  }
};

// POST /api/categories - Create category with hierarchy support
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

    console.log('📝 Creating category:', { name, parentCategory, isFolder });

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    // Validate parent category exists if specified
    let parentCat = null;
    if (parentCategory) {
      parentCat = await ArticleCategory.findById(parentCategory);
      if (!parentCat) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }

      // Prevent deep nesting (max 3 levels: 0, 1, 2)
      if (parentCat.level >= 2) {
        return res.status(400).json({
          success: false,
          message: 'Maximum category depth of 3 levels allowed'
        });
      }
    }

    // Check for duplicate names at the same level
    const duplicateQuery = {
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      parentCategory: parentCategory || null
    };
    
    const existingCategory = await ArticleCategory.findOne(duplicateQuery);
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists at this level'
      });
    }

    // Calculate level and path
    let level = 0;
    let categoryPath = [];
    
    if (parentCat) {
      level = parentCat.level + 1;
      categoryPath = [...(parentCat.categoryPath || []), parentCat._id];
    }

    // Get sort order if not provided
    let finalSortOrder = sortOrder || 0;
    if (!sortOrder) {
      const siblingCount = await ArticleCategory.countDocuments({
        parentCategory: parentCategory || null
      });
      finalSortOrder = siblingCount;
    }

    const category = new ArticleCategory({
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon?.trim() || '',
      color: color || '#6366f1',
      parentCategory: parentCategory || null,
      categoryPath,
      level,
      isFolder: Boolean(isFolder),
      sortOrder: finalSortOrder,
      createdBy: req.user.id
    });

    await category.save();

    // Populate for response
    await category.populate('parentCategory', 'name slug');

    console.log('✅ Category created successfully:', category._id);

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('❌ Create Category Error:', error);
    next(error);
  }
};

// PUT /api/categories/:id - Update category
exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('📝 Updating category:', id, updateData);

    const category = await ArticleCategory.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Prevent moving category to create circular reference
    if (updateData.parentCategory && updateData.parentCategory !== category.parentCategory?.toString()) {
      const newParent = await ArticleCategory.findById(updateData.parentCategory);
      if (!newParent) {
        return res.status(400).json({
          success: false,
          message: 'New parent category not found'
        });
      }

      // Check if new parent would create circular reference
      const wouldCreateCycle = await checkCircularReference(id, updateData.parentCategory);
      if (wouldCreateCycle) {
        return res.status(400).json({
          success: false,
          message: 'Cannot move category under its own descendant'
        });
      }

      // Update level and path
      updateData.level = newParent.level + 1;
      updateData.categoryPath = [...(newParent.categoryPath || []), newParent._id];
    }

    // Update category
    Object.assign(category, updateData);
    await category.save();

    // Update descendant paths if parent changed
    if (updateData.parentCategory !== undefined) {
      await updateDescendantPaths(id);
    }

    await category.populate('parentCategory', 'name slug');

    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('❌ Update Category Error:', error);
    next(error);
  }
};

// DELETE /api/categories/:id - Delete category (Admin only)
exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await ArticleCategory.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has articles
    const articleCount = await Article.countDocuments({ category: id });
    if (articleCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${articleCount} articles. Please move or delete articles first.`
      });
    }

    // Check if category has children
    const childrenCount = await ArticleCategory.countDocuments({ parentCategory: id });
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${childrenCount} subcategories. Please move or delete subcategories first.`
      });
    }

    await ArticleCategory.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete Category Error:', error);
    next(error);
  }
};

// PUT /api/categories/reorder - Reorder categories
exports.reorderCategories = async (req, res, next) => {
  try {
    const { categoryId, newIndex, parentId } = req.body;

    const category = await ArticleCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get siblings at the target level
    const siblings = await ArticleCategory.find({
      parentCategory: parentId || null,
      _id: { $ne: categoryId }
    }).sort({ sortOrder: 1 });

    // Update sort orders
    const updates = [];
    
    // Insert the moved category at new position
    siblings.splice(newIndex, 0, category);
    
    // Update all categories with new sort orders
    for (let i = 0; i < siblings.length; i++) {
      updates.push({
        updateOne: {
          filter: { _id: siblings[i]._id },
          update: { sortOrder: i, parentCategory: parentId || null }
        }
      });
    }

    if (updates.length > 0) {
      await ArticleCategory.bulkWrite(updates);
    }

    res.json({
      success: true,
      message: 'Categories reordered successfully'
    });
  } catch (error) {
    console.error('❌ Reorder Categories Error:', error);
    next(error);
  }
};

// GET /api/categories/:id/breadcrumb - Get category with breadcrumb
exports.getCategoryWithBreadcrumb = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await ArticleCategory.findById(id)
      .populate('categoryPath', 'name slug')
      .populate('parentCategory', 'name slug');

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Build breadcrumb
    const breadcrumb = [
      ...(category.categoryPath || []).map(cat => ({
        _id: cat._id,
        name: cat.name,
        slug: cat.slug
      })),
      {
        _id: category._id,
        name: category.name,
        slug: category.slug
      }
    ];

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        breadcrumb
      }
    });
  } catch (error) {
    console.error('❌ Category Breadcrumb Error:', error);
    next(error);
  }
};

// GET /api/categories/level - Get categories by level
exports.getCategoriesByLevel = async (req, res, next) => {
  try {
    const { level = 0 } = req.query;

    const categories = await ArticleCategory.find({
      level: parseInt(level),
      isVisible: true
    }).sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('❌ Categories by Level Error:', error);
    next(error);
  }
};

// Helper Functions
async function checkCircularReference(categoryId, newParentId) {
  const category = await ArticleCategory.findById(categoryId);
  if (!category) return false;

  // Check if new parent is in the current category's descendants
  const descendants = await ArticleCategory.find({
    categoryPath: categoryId
  });

  return descendants.some(desc => desc._id.toString() === newParentId);
}

async function updateDescendantPaths(categoryId) {
  // Find all descendants
  const descendants = await ArticleCategory.find({
    categoryPath: categoryId
  });

  // Update each descendant's path
  for (const descendant of descendants) {
    descendant.markModified('parentCategory');
    await descendant.save();
  }
}