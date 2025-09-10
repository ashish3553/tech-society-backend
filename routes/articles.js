// routes/articles.js - Clean Routes with Controller Calls
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { canEditArticle, canPublishArticle } = require('../middleware/authorAuth');
const articleController = require('../controllers/articleController');


// ==========================================
// PUBLIC ROUTES
// ==========================================

// GET /api/articles - Get published articles
router.get('/', articleController.getPublishedArticles);

const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Ignore token errors for optional auth
      req.user = null;
    }
  }
  
  next();
};

router.get('/:id', optionalAuth,articleController.getArticleById);
// ==========================================
// PROTECTED ROUTES
// ==========================================
router.use(auth)

// Article CRUD Operations
router.get('/my',auth, authorize('admin', 'mentor','author'),  articleController.getMyArticles);
router.get('/all', authorize('admin', 'mentor','author'), articleController.getAllArticles);
router.get('/by-category',auth, authorize('admin', 'mentor','author'), articleController.getArticlesByCategory);


// GET /api/articles/:id - Get single article


router.post('/', authorize('admin', 'mentor', 'author'), articleController.createArticle);
router.get('/:id/edit', canEditArticle, articleController.getArticleForEdit);
router.put('/:id', canEditArticle, articleController.updateArticle);
router.delete('/:id', canEditArticle, articleController.deleteArticle);

// Article Publishing
router.put('/:id/publish', canPublishArticle, articleController.publishArticle);
router.put('/:id/unpublish', canEditArticle, articleController.unpublishArticle);

// Article Engagement
router.post('/:id/like', articleController.likeArticle);
router.post('/:id/view', optionalAuth, articleController.trackArticleView);


// Comments
router.post('/:id/comments', articleController.addComment);
router.get('/:id/comments', articleController.getComments);
router.post('/comments/:id/like', articleController.likeComment);

// Characters Management
router.get('/characters/my', articleController.getMyCharacters);
router.post('/characters', articleController.createCharacter);
router.put('/characters/:id', articleController.updateCharacter);
router.delete('/characters/:id', articleController.deleteCharacter);

// Categories Management (Legacy routes for backward compatibility)
router.get('/categories', articleController.getCategories);
router.post('/categories', authorize('admin', 'mentor'), articleController.createCategory);
router.put('/categories/:id', authorize('admin'), articleController.updateCategory);
router.delete('/categories/:id', authorize('admin'), articleController.deleteCategory);

// Add these routes to your routes/articles.js

// Admin article ordering routes
router.get('/admin/reorder/:categoryId', auth, authorize('admin', 'mentor','author'), articleController.getArticlesForReordering);
router.put('/admin/reorder', auth, authorize('admin', 'mentor','author'), articleController.reorderArticles);
router.put('/:id/move-category', auth, authorize('admin', 'mentor','author'), articleController.moveArticleCategory);

module.exports = router;