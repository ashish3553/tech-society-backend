// models/ArticleCategory.js - Enhanced with hierarchical support
const mongoose = require('mongoose');

const ArticleCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: String,
  description: String,
  icon: String, // Lucide icon name or image URL
  color: { type: String, default: '#6366f1' },
  
  // Hierarchical support
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ArticleCategory', default: null },
  categoryPath: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ArticleCategory' }], // For quick ancestor lookup
  level: { type: Number, default: 0 }, // 0 = root, 1 = subcategory, 2 = sub-subcategory
  
  // Display and organization
  isVisible: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  isFolder: { type: Boolean, default: false }, // True if this category acts as a folder container
  
  // SEO and metadata
  metaDescription: String,
  keywords: [String],
  
  // Analytics
  articleCount: { type: Number, default: 0 }, // Cached count for performance
  totalViews: { type: Number, default: 0 },
  
  // Admin controls
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isProtected: { type: Boolean, default: false }, // Prevents deletion if has articles
}, {
  timestamps: true
});

// Indexes for performance
ArticleCategorySchema.index({ parentCategory: 1, sortOrder: 1 });
ArticleCategorySchema.index({ level: 1, isVisible: 1 });
ArticleCategorySchema.index({ slug: 1 });
ArticleCategorySchema.index({ categoryPath: 1 });

// Generate slug and path before saving
ArticleCategorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
  }
  
  // Update category path and level
  if (this.isModified('parentCategory') || this.isNew) {
    if (this.parentCategory) {
      const parent = await this.constructor.findById(this.parentCategory);
      if (parent) {
        this.categoryPath = [...parent.categoryPath, parent._id];
        this.level = parent.level + 1;
      }
    } else {
      this.categoryPath = [];
      this.level = 0;
    }
  }
  
  next();
});

// Update article counts after article operations
ArticleCategorySchema.methods.updateArticleCount = async function() {
  const Article = require('./Article');
  this.articleCount = await Article.countDocuments({ 
    category: this._id,
    isPublished: true 
  });
  await this.save();
};

// Get full hierarchy path with names
ArticleCategorySchema.methods.getFullPath = async function() {
  await this.populate('categoryPath', 'name slug');
  const pathNames = this.categoryPath.map(cat => ({
    _id: cat._id,
    name: cat.name,
    slug: cat.slug
  }));
  return [...pathNames, { _id: this._id, name: this.name, slug: this.slug }];
};

// Static method to get category tree
ArticleCategorySchema.statics.getCategoryTree = async function(parentId = null) {
  const categories = await this.find({ 
    parentCategory: parentId,
    isVisible: true 
  }).sort({ sortOrder: 1, name: 1 });
  
  const tree = [];
  for (const category of categories) {
    const children = await this.getCategoryTree(category._id);
    tree.push({
      ...category.toObject(),
      children
    });
  }
  
  return tree;
};

// Static method to get flattened category list with indentation
ArticleCategorySchema.statics.getFlattenedCategories = async function() {
  const categories = await this.find({ isVisible: true })
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .populate('parentCategory', 'name');
  
  return categories.map(cat => ({
    ...cat.toObject(),
    indentedName: '  '.repeat(cat.level) + cat.name,
    breadcrumb: cat.categoryPath.length > 0 ? 'Sub-category' : 'Main Category'
  }));
};

module.exports = mongoose.model('ArticleCategory', ArticleCategorySchema);