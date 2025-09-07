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



// ==========================================
// PROTECTED ROUTES
// ==========================================
router.use(auth);

// Article CRUD Operations
router.get('/my', articleController.getMyArticles);
router.get('/all', authorize('admin', 'mentor'), articleController.getAllArticles);

// GET /api/articles/:id - Get single article
router.get('/:id', articleController.getArticleById);


router.post('/', authorize('admin', 'mentor', 'author'), articleController.createArticle);
router.get('/:id/edit', canEditArticle, articleController.getArticleForEdit);
router.put('/:id', canEditArticle, articleController.updateArticle);
router.delete('/:id', canEditArticle, articleController.deleteArticle);

// Article Publishing
router.put('/:id/publish', canPublishArticle, articleController.publishArticle);
router.put('/:id/unpublish', canEditArticle, articleController.unpublishArticle);

// Article Engagement
router.post('/:id/like', articleController.likeArticle);

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

module.exports = router;