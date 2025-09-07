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

const getArticleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { preview = false } = req.query;

    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid article ID'
      });
    }

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

    // Check if article is published (unless preview mode)
    if (!article.isPublished && !preview) {
      return res.status(404).json({
        success: false,
        message: 'Article not available'
      });
    }

    // Check visibility permissions
    if (!article.isVisibleToUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this article'
      });
    }

    // Increment view count for published articles (only if not preview and user is logged in)
    if (article.isPublished && !preview && req.user) {
      article.views += 1;
      await article.save();
    }

    // For non-logged users, return partial content for engagement
    let responseData = article;
    if (!req.user) {
      responseData = {
        ...article.toObject(),
        articleFlow: article.articleFlow.slice(0, 5), // First 5 elements only
        isPartial: true,
        loginRequired: true
      };
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    next(error);
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

// ==========================================
// CONTROLLER EXPORTS
// ==========================================

module.exports = {
  // Article CRUD
  createArticle,
  getMyArticles,
  getAllArticles,
  getPublishedArticles,
  getArticleById,
  getArticleForEdit,
  updateArticle,
  deleteArticle,
  
  // Article Publishing
  publishArticle,
  unpublishArticle,
  
  // Article Engagement
  likeArticle,
  
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