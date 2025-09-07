// middleware/authorAuth.js - Author-specific permissions middleware
const Author = require('../models/Author');
const Article = require('../models/Article');

// Check if user is an active author
const requireAuthor = async (req, res, next) => {
  try {
    const author = await Author.findOne({ 
      userId: req.user.id,
      isActive: true,
      'invitation.status': 'accepted'
    });

    if (!author) {
      return res.status(403).json({
        success: false,
        message: 'Author access required. Please contact an administrator.'
      });
    }

    req.author = author;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking author permissions'
    });
  }
};

// Check if author has specific permission
const requireAuthorPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.author) {
        // Try to get author if not already set
        const author = await Author.findOne({ 
          userId: req.user.id,
          isActive: true,
          'invitation.status': 'accepted'
        });

        if (!author) {
          return res.status(403).json({
            success: false,
            message: 'Author access required'
          });
        }
        req.author = author;
      }

      if (!req.author.permissions[permission]) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permission} required`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking author permissions'
      });
    }
  };
};

// Check if author can edit specific article
const canEditArticle = async (req, res, next) => {
  try {
    const { id: articleId } = req.params;
    
    if (!articleId) {
      return res.status(400).json({
        success: false,
        message: 'Article ID required'
      });
    }

    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Admin can edit any article
    if (req.user.role === 'admin') {
      req.article = article;
      return next();
    }

    // Check if user is the article creator
    if (article.createdBy.toString() === req.user.id) {
      req.article = article;
      return next();
    }

    // Check if user is a collaborating author
    const author = await Author.findOne({ 
      userId: req.user.id,
      isActive: true,
      'collaborations.article': articleId
    });

    if (!author) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this article'
      });
    }

    // Check if author has write permissions
    if (!author.permissions.canWrite) {
      return res.status(403).json({
        success: false,
        message: 'You do not have write permissions'
      });
    }

    req.author = author;
    req.article = article;
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking article permissions'
    });
  }
};

// Check if author can publish article
const canPublishArticle = async (req, res, next) => {
  try {
    const { id: articleId } = req.params;
    
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Admin can publish any article
    if (req.user.role === 'admin') {
      req.article = article;
      return next();
    }

    // Check if user is the article creator
    if (article.createdBy.toString() === req.user.id) {
      // Check if user has author publish permissions
      const author = await Author.findOne({ userId: req.user.id });
      if (author && author.permissions.canPublish) {
        req.article = article;
        req.author = author;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to publish articles. Contact an administrator.'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking publish permissions'
    });
  }
};

// Check if author can invite other authors
const canInviteAuthors = async (req, res, next) => {
  try {
    // Admin can always invite
    if (req.user.role === 'admin') {
      return next();
    }

    const author = await Author.findOne({ 
      userId: req.user.id,
      isActive: true 
    });

    if (!author || !author.permissions.canInviteOthers) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to invite other authors'
      });
    }

    req.author = author;
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking invitation permissions'
    });
  }
};

// Get author dashboard data with proper filtering
const getAuthorDashboardData = async (req, res, next) => {
  try {
    const author = await Author.findOne({ 
      userId: req.user.id,
      isActive: true 
    });

    if (!author) {
      // User is not an author, return limited data
      req.dashboardData = {
        isAuthor: false,
        canCreateArticles: req.user.role === 'mentor' || req.user.role === 'admin',
        role: req.user.role
      };
      return next();
    }

    // Get author's articles and collaborations
    const myArticles = await Article.find({ createdBy: req.user.id })
      .select('title isPublished views likes createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    const collaborativeArticles = await Article.find({ 
      authors: author._id,
      createdBy: { $ne: req.user.id }
    })
      .populate('createdBy', 'name email')
      .select('title isPublished views likes createdAt createdBy')
      .sort({ createdAt: -1 })
      .limit(10);

    req.dashboardData = {
      isAuthor: true,
      author: {
        id: author._id,
        profile: author.profile,
        permissions: author.permissions,
        analytics: author.analytics
      },
      myArticles,
      collaborativeArticles,
      role: req.user.role
    };

    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
};

module.exports = {
  requireAuthor,
  requireAuthorPermission,
  canEditArticle,
  canPublishArticle,
  canInviteAuthors,
  getAuthorDashboardData
};