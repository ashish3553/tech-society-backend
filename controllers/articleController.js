// controllers/articleController.js - Complete Controller with Proper Exports
const Article = require('../models/Article');
const Character = require('../models/Character');
const ArticleCategory = require('../models/ArticleCategory');
const ArticleComment = require('../models/ArticleComment');
const ArticleQuiz = require('../models/ArticleQuiz');
const User = require('../models/User');
const Author = require('../models/Author');

// Helper function to calculate reading time
function calculateReadingTime(messages, contentBlocks) {
  let wordCount = 0;
  
  // Count words in messages
  messages.forEach(msg => {
    wordCount += msg.message.split(' ').length;
  });
  
  // Count words in content blocks
  contentBlocks.forEach(block => {
    if (block.type === 'text' && block.content.html) {
      const textContent = block.content.html.replace(/<[^>]*>/g, '');
      wordCount += textContent.split(' ').length;
    }
  });
  
  // Average reading speed: 200 words per minute
  return Math.ceil(wordCount / 200);
}

// ==========================================
// ARTICLE CRUD OPERATIONS
// ==========================================

const createArticle = async (req, res, next) => {
  try {
    const {
      title,
      subtitle,
      description,
      characters,
      messages,
      contentBlocks,
      articleFlow,
      category,
      tags,
      visibility
    } = req.body;

    // Calculate reading time
    const readingTime = calculateReadingTime(messages || [], contentBlocks || []);

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

    const article = new Article({
      title,
      subtitle,
      description,
      characters: characters || [],
      messages: messages || [],
      contentBlocks: contentBlocks || [],
      articleFlow: articleFlow || [],
      category,
      tags: tags || [],
      readingTime,
      slug: `${slug}-${Date.now()}`,
      visibility: visibility || { type: 'all' },
      createdBy: req.user.id
    });

    await article.save();
    
    // Populate references for response
    await article.populate([
      { path: 'characters' },
      { path: 'category', select: 'name slug color' },
      { path: 'createdBy', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      data: article,
      message: 'Article created successfully'
    });
  } catch (error) {
    console.error('Error creating article:', error);
    next(error);
  }
};

const getMyArticles = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sort = 'latest',
      status = 'all'
    } = req.query;

    const query = { createdBy: req.user.id };
    
    // Add status filter
    if (status !== 'all') {
      if (status === 'published') {
        query.isPublished = true;
      } else if (status === 'draft') {
        query.isPublished = false;
      }
    }
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sort options
    let sortOptions = {};
    switch (sort) {
      case 'popular':
        sortOptions = { views: -1, likes: -1 };
        break;
      case 'views':
        sortOptions = { views: -1 };
        break;
      case 'likes':
        sortOptions = { 'likes.length': -1 };
        break;
      case 'alphabetical':
        sortOptions = { title: 1 };
        break;
      default: // latest
        sortOptions = { createdAt: -1 };
    }

    const articles = await Article.find(query)
      .populate('category', 'name slug color icon')
      .populate('createdBy', 'name email')
      .populate('authors', 'profile.name profile.email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Article.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching my articles:', error);
    next(error);
  }
};

const getAllArticles = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      author,
      search,
      sort = 'latest',
      status = 'all'
    } = req.query;

    const query = {};
    
    // Add status filter
    if (status !== 'all') {
      if (status === 'published') {
        query.isPublished = true;
      } else if (status === 'draft') {
        query.isPublished = false;
      }
    }
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add author filter
    if (author) {
      query.createdBy = author;
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sort options
    let sortOptions = {};
    switch (sort) {
      case 'popular':
        sortOptions = { views: -1, likes: -1 };
        break;
      case 'views':
        sortOptions = { views: -1 };
        break;
      case 'likes':
        sortOptions = { 'likes.length': -1 };
        break;
      case 'alphabetical':
        sortOptions = { title: 1 };
        break;
      default: // latest
        sortOptions = { createdAt: -1 };
    }

    const articles = await Article.find(query)
      .populate('category', 'name slug color icon')
      .populate('createdBy', 'name email')
      .populate('authors', 'profile.name profile.email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Article.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching all articles:', error);
    next(error);
  }
};

const getPublishedArticles = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sort = 'latest'
    } = req.query;
    
    const query = { isPublished: true };
    
    // Add visibility filtering based on user role
    if (req.user) {
      // If user is logged in, check visibility
      query.$or = [
        { 'visibility.type': 'all' },
        { 'visibility.specificUsers': req.user.id }
      ];
    } else {
      // For non-logged users, only show public articles  
      query['visibility.type'] = 'all';
    }
    
    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Sort options
    let sortOptions = {};
    switch (sort) {
      case 'popular':
        sortOptions = { views: -1, likes: -1 };
        break;
      case 'views':
        sortOptions = { views: -1 };
        break;
      case 'likes':
        sortOptions = { 'likes.length': -1 };
        break;
      case 'alphabetical':
        sortOptions = { title: 1 };
        break;
      default: // latest
        sortOptions = { createdAt: -1 };
    }

    const articles = await Article.find(query)
      .populate('category', 'name slug color icon')
      .populate('createdBy', 'name email')
      .select('title subtitle description shareImage readingTime views likes createdAt publishedAt slug tags category createdBy')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Article.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalResults: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching published articles:', error);
    next(error);
  }
};

// Add these methods to your articleController.js

// GET /api/articles/admin/reorder/:categoryId - Get articles for reordering
const getArticlesForReordering = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    // Only admins can access this
    if (req.user.role !== 'admin' && req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators and mentors can reorder articles'
      });
    }

    const articles = await Article.find({ category: categoryId })
      .select('title subtitle sortOrder createdAt isPublished views')
      .populate('createdBy', 'name')
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: articles,
      count: articles.length
    });
  } catch (error) {
    console.error('Get articles for reordering error:', error);
    next(error);
  }
};

// PUT /api/articles/admin/reorder - Reorder articles within a category
const reorderArticles = async (req, res, next) => {
  try {
    const { categoryId, articleOrders } = req.body;
    
    // Only admins can reorder
    if (req.user.role !== 'admin' && req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators and mentors can reorder articles'
      });
    }

    // Validate input
    if (!categoryId || !Array.isArray(articleOrders)) {
      return res.status(400).json({
        success: false,
        message: 'Category ID and article orders array are required'
      });
    }

    // Update each article's sortOrder
    const bulkOps = articleOrders.map((item, index) => ({
      updateOne: {
        filter: { _id: item.articleId, category: categoryId },
        update: { sortOrder: index }
      }
    }));

    if (bulkOps.length > 0) {
      await Article.bulkWrite(bulkOps);
    }

    res.json({
      success: true,
      message: `Successfully reordered ${bulkOps.length} articles`,
      data: { reorderedCount: bulkOps.length }
    });
  } catch (error) {
    console.error('Reorder articles error:', error);
    next(error);
  }
};

// PUT /api/articles/:id/move-category - Move article to different category
const moveArticleCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newCategoryId, newSortOrder } = req.body;
    
    // Only admins can move articles
    if (req.user.role !== 'admin' && req.user.role !== 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators and mentors can move articles'
      });
    }

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Validate new category exists and is not a folder
    const newCategory = await ArticleCategory.findById(newCategoryId);
    if (!newCategory) {
      return res.status(400).json({
        success: false,
        message: 'New category not found'
      });
    }

    if (newCategory.isFolder) {
      return res.status(400).json({
        success: false,
        message: 'Articles cannot be moved to folder categories'
      });
    }

    // Update article
    article.category = newCategoryId;
    article.sortOrder = newSortOrder || 0;
    await article.save();

    res.json({
      success: true,
      message: 'Article moved successfully',
      data: article
    });
  } catch (error) {
    console.error('Move article category error:', error);
    next(error);
  }
};



// In your article controller, add:
// Update this existing method in your articleController.js
const getArticlesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const {
      page = 1,
      limit = 20,
      sort = 'sortOrder', // Default to sortOrder instead of createdAt
      status = 'published'
    } = req.query;

    // Build query
    const query = { category: categoryId };
    
    if (status === 'published') {
      query.isPublished = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // UPDATED: Sort by sortOrder within category for proper chronology
    const articles = await Article.find(query)
      .populate('createdBy', 'name email profileImage')
      .populate('category', 'name color slug')
      .populate('authors', 'name email')
      .sort({ sortOrder: 1, createdAt: 1 }) // sortOrder first, then createdAt
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Article.countDocuments(query);

    res.json({
      success: true,
      data: articles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalArticles: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get articles by category error:', error);
    next(error);
  }
};
// In controllers/articleController.js - getArticleById function
const getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { preview } = req.query;

    console.log('🔍 Debug - req.user:', req.user);
    console.log('🔍 Debug - req.user.role:', req.user?.role);
    console.log('🔍 Debug - preview query:', preview);

    // Validate article ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid article ID format'
      });
    }

    // FIXED: Properly declare article variable
    const article = await Article.findById(id)
      .populate('createdBy', 'name email')
      .populate('category', 'name color')
      .populate('characters')
      .populate('authors', 'name email');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    console.log('🔍 Debug - article found:', article.title);
    console.log('🔍 Debug - article.isPublished:', article.isPublished);

    // FIXED: Handle case when user is not authenticated (optionalAuth)
    if (!req.user) {
      // Only allow access to published articles for unauthenticated users
      if (!article.isPublished) {
        return res.status(401).json({
          success: false,
          message: 'This article is not published. Please login to view drafts.'
        });
      }
      
      // For published articles, allow unauthenticated access
      return res.json({
        success: true,
        data: article
      });
    }

    // Enhanced access control for authenticated users
    const isPublished = article.isPublished;
    const isAuthor = article.createdBy._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isMentor = req.user.role === 'mentor';
    const isCollaborator = article.authors?.some(author => 
      author._id.toString() === req.user.id
    );

    console.log('🔍 Debug - Access control:', {
      isPublished,
      isAuthor,
      isAdmin,
      isMentor,
      isCollaborator,
      userRole: req.user.role
    });

    const canViewDraft = (
      isPublished ||           // Published articles
      isAuthor ||             // Article author
      isAdmin ||              // Admin users
      isMentor ||             // Mentor users
      isCollaborator          // Collaborating authors
    );

    if (!canViewDraft) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this draft article.',
        debug: {
          isPublished,
          isAuthor,
          isAdmin,
          isMentor,
          userRole: req.user.role
        }
      });
    }

    // Track view count for published articles (exclude author views)
    if (isPublished && !isAuthor) {
      article.views = (article.views || 0) + 1;
      await article.save();
    }

    res.json({
      success: true,
      data: article
    });

  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getArticleForEdit = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('characters')
      .populate('category', 'name slug color icon')
      .populate('createdBy', 'name email')
      .populate('authors', 'profile.name profile.email');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('Error fetching article for edit:', error);
    next(error);
  }
};

const updateArticle = async (req, res, next) => {
  try {
    const articleId = req.params.id;
    const updateData = req.body;

    // Recalculate reading time if content changed
    if (updateData.messages || updateData.contentBlocks) {
      updateData.readingTime = calculateReadingTime(
        updateData.messages || [], 
        updateData.contentBlocks || []
      );
    }

    // Update slug if title changed
    if (updateData.title) {
      updateData.slug = updateData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60) + '-' + Date.now();
    }

    const article = await Article.findByIdAndUpdate(
      articleId,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('characters')
    .populate('category', 'name slug color icon')
    .populate('createdBy', 'name email')
    .populate('authors', 'profile.name profile.email');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: article,
      message: 'Article updated successfully'
    });
  } catch (error) {
    console.error('Error updating article:', error);
    next(error);
  }
};

const deleteArticle = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Delete associated comments
    await ArticleComment.deleteMany({ article: req.params.id });

    // Delete the article
    await Article.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Article deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    next(error);
  }
};

const publishArticle = async (req, res, next) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { 
        isPublished: true, 
        publishedAt: new Date(),
        publishedBy: req.user.id
      },
      { new: true }
    )
    .populate('category', 'name slug color icon')
    .populate('createdBy', 'name email');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: article,
      message: 'Article published successfully'
    });
  } catch (error) {
    console.error('Error publishing article:', error);
    next(error);
  }
};

const unpublishArticle = async (req, res, next) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { 
        isPublished: false, 
        publishedAt: null 
      },
      { new: true }
    )
    .populate('category', 'name slug color icon')
    .populate('createdBy', 'name email');

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: article,
      message: 'Article unpublished successfully'
    });
  } catch (error) {
    console.error('Error unpublishing article:', error);
    next(error);
  }
};

const likeArticle = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const userLiked = article.likes.includes(req.user.id);

    if (userLiked) {
      // Unlike
      article.likes = article.likes.filter(id => id.toString() !== req.user.id);
    } else {
      // Like
      article.likes.push(req.user.id);
    }

    await article.save();

    res.json({
      success: true,
      data: {
        liked: !userLiked,
        likesCount: article.likes.length
      }
    });
  } catch (error) {
    console.error('Error liking article:', error);
    next(error);
  }
};

// ==========================================
// CHARACTER MANAGEMENT
// ==========================================

const createCharacter = async (req, res, next) => {
  try {
    const character = new Character({
      ...req.body,
      createdBy: req.user.id
    });

    await character.save();

    res.status(201).json({
      success: true,
      data: character
    });
  } catch (error) {
    console.error('Error creating character:', error);
    next(error);
  }
};

const getMyCharacters = async (req, res, next) => {
  try {
    const characters = await Character.find({})  // Get ALL characters for sharing
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: characters
    });
  } catch (error) {
    console.error('Error fetching characters:', error);
    next(error);
  }
};

const updateCharacter = async (req, res, next) => {
  try {
    const character = await Character.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Character not found or not authorized'
      });
    }

    res.json({
      success: true,
      data: character
    });
  } catch (error) {
    console.error('Error updating character:', error);
    next(error);
  }
};

const deleteCharacter = async (req, res, next) => {
  try {
    const character = await Character.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Character not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Character deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting character:', error);
    next(error);
  }
};

// ==========================================
// CATEGORY MANAGEMENT (LEGACY)
// ==========================================

const createCategory = async (req, res, next) => {
  try {
    const { name, description, color, icon, isVisible, sortOrder } = req.body;

    const existingCategory = await ArticleCategory.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const category = new ArticleCategory({
      name,
      description,
      color: color || '#2196f3',
      icon: icon || 'folder',
      isVisible: isVisible !== false,
      sortOrder: sortOrder || 0,
      createdBy: req.user.id
    });

    await category.save();

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await ArticleCategory.find({ 
      isVisible: true 
    })
    .populate('createdBy', 'name email')
    .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: categories || []
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.json({
      success: true,
      data: []
    });
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { name, description, color, icon, isVisible, sortOrder } = req.body;

    const category = await ArticleCategory.findOneAndUpdate(
      { _id: req.params.id },
      { name, description, color, icon, isVisible, sortOrder },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const articlesCount = await Article.countDocuments({ category: req.params.id });
    
    if (articlesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It is being used by ${articlesCount} article(s)`
      });
    }

    const category = await ArticleCategory.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    next(error);
  }
};

// ==========================================
// COMMENT MANAGEMENT
// ==========================================

const addComment = async (req, res, next) => {
  try {
    const { content, parentComment } = req.body;
    const articleId = req.params.id;
    console.log("Req.user is:", req.user)

    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const comment = new ArticleComment({
      article: articleId,
      user: req.user.id,
      content,
      parentComment
    });

    await comment.save();
    await comment.populate('user', 'name email');

    if (parentComment) {
      await ArticleComment.findByIdAndUpdate(
        parentComment,
        { $push: { replies: comment._id } }
      );
    }

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const articleId = req.params.id;

    const comments = await ArticleComment.find({
      article: articleId,
      parentComment: null
    })
    .populate('user', 'name email')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'name email'
      }
    })
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    next(error);
  }
};

const likeComment = async (req, res, next) => {
  try {
    const comment = await ArticleComment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const userLiked = comment.likes.includes(req.user.id);

    if (userLiked) {
      comment.likes = comment.likes.filter(id => id.toString() !== req.user.id);
    } else {
      comment.likes.push(req.user.id);
    }

    await comment.save();

    res.json({
      success: true,
      data: {
        liked: !userLiked,
        likesCount: comment.likes.length
      }
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    next(error);
  }
};



const getArticleWithMetadata = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { preview = false } = req.query;

    const article = await Article.findById(id)
      .populate('characters')
      .populate('category', 'name slug color icon')
      .populate('createdBy', 'name email')
      .populate('authors', 'profile.name profile.email profile.avatar profile.verified')
      .populate({
        path: 'contentBlocks.content.quizId',
        populate: {
          path: 'questions',
          select: 'type content options correctAnswers'
        }
      });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Enhanced metadata
    const metadata = {
      readingTime: article.readingTime,
      wordCount: calculateWordCount(article),
      lastUpdated: article.updatedAt,
      publishedAt: article.publishedAt,
      views: article.views,
      likes: article.likes?.length || 0,
      commentsCount: article.comments?.length || 0,
      collaboratorsCount: article.authors?.length || 0,
      contentStats: {
        totalBlocks: article.contentBlocks.length,
        messages: article.messages.length,
        images: article.contentBlocks.filter(b => b.type === 'image').length,
        videos: article.contentBlocks.filter(b => b.type === 'video').length,
        code: article.contentBlocks.filter(b => b.type === 'code').length,
        carousels: article.contentBlocks.filter(b => b.type === 'carousel').length
      }
    };

    // Author attribution
    const authorInfo = {
      mainAuthor: {
        id: article.createdBy._id,
        name: article.createdBy.name,
        email: article.createdBy.email,
        role: 'owner'
      },
      collaborators: article.authors.map(author => ({
        id: author._id,
        name: author.profile.name,
        email: author.profile.email,
        avatar: author.profile.avatar,
        verified: author.profile.verified,
        role: 'collaborator'
      }))
    };

    res.json({
      success: true,
      data: {
        ...article.toObject(),
        metadata,
        authorInfo
      }
    });

  } catch (error) {
    next(error);
  }
};

// Helper function to calculate word count
function calculateWordCount(article) {
  let wordCount = 0;
  
  // Count words in messages
  article.messages.forEach(msg => {
    if (msg.message) {
      wordCount += msg.message.split(' ').length;
    }
  });
  
  // Count words in content blocks
  article.contentBlocks.forEach(block => {
    if (block.type === 'text' && block.content.html) {
      const textContent = block.content.html.replace(/<[^>]*>/g, '');
      wordCount += textContent.split(' ').length;
    }
    if (block.type === 'carousel' && block.content.slides) {
      block.content.slides.forEach(slide => {
        if (slide.title) wordCount += slide.title.split(' ').length;
        if (slide.subtitle) wordCount += slide.subtitle.split(' ').length;
        if (slide.description) wordCount += slide.description.split(' ').length;
      });
    }
  });
  
  return wordCount;
}


// POST /api/articles/:id/view - Track article view
// Update trackArticleView to handle optional auth
// Update trackArticleView to handle optional auth
const trackArticleView = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Optional user

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Always increment view count
    article.views = (article.views || 0) + 1;
    
    // Only track unique views if user is logged in
    if (userId && !article.viewedBy?.includes(userId)) {
      article.viewedBy = article.viewedBy || [];
      article.viewedBy.push(userId);
    }
    
    await article.save();

    res.json({
      success: true,
      data: {
        views: article.views,
        message: 'View tracked successfully'
      }
    });
  } catch (error) {
    console.error('Track view error:', error);
    next(error);
  }
};

// ==========================================
// CONTROLLER EXPORTS
// ==========================================

module.exports = {
  // Article CRUD
  createArticle,
  getArticleWithMetadata,
  getMyArticles,
  getAllArticles,
  getPublishedArticles,
  getArticleById,
  getArticleForEdit,
  updateArticle,
  deleteArticle,
  getArticlesByCategory,
  reorderArticles,
  getArticlesForReordering,
  moveArticleCategory,
  
  // Article Publishing 
  publishArticle,
  unpublishArticle,
  
  // Article Engagement
  likeArticle,
  trackArticleView,
  
  // Characters
  createCharacter,
  getMyCharacters,
  updateCharacter,
  deleteCharacter,
  
  // Categories (Legacy)
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  
  // Comments
  addComment,
  getComments,
  likeComment
};