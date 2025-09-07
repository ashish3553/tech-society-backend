// routes/authors.js - Clean and Organized Author Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const authorController = require('../controllers/authorController');

// =============================================================================
// PUBLIC ROUTES (No Authentication Required)
// =============================================================================

// Verify invitation token
router.get('/verify-invitation/:token', authorController.verifyInvitation);

// Accept invitation (creates new account)
router.post('/accept-invitation', authorController.acceptInvitation);

// Get author public profile (for article attribution)
router.get('/:authorId/public', authorController.getAuthorPublicProfile);

// =============================================================================
// PROTECTED ROUTES (Authentication Required)
// =============================================================================
router.use(auth);

// -----------------------------------------------------------------------------
// INVITATION MANAGEMENT (Admin/Mentor Only)
// -----------------------------------------------------------------------------

console.log("Hitting here 1")
// Send author invitation
router.post('/invite', 
  authorize('admin', 'mentor'), 
  authorController.inviteAuthor
);
console.log("Hitting here 2")

// Resend invitation
router.post('/:authorId/resend-invitation', 
  authorize('admin', 'mentor'), 
  authorController.resendInvitation
);

console.log("Hitting here 3")


// Accept invitation for existing user
router.post('/accept-invitation-existing', authorController.acceptInvitationExisting);

// -----------------------------------------------------------------------------
// AUTHOR PROFILE MANAGEMENT
// -----------------------------------------------------------------------------

// Get current user's author profile
router.get('/me', authorController.getMyAuthorProfile);

// Update current user's author profile
router.put('/me', authorController.updateMyAuthorProfile);

// Get all authors (Admin/Mentor only)
router.get('/', 
  authorize('admin', 'mentor','author'), 
  authorController.getAllAuthors
);

// Get author stats for dashboard (Admin/Mentor only)
router.get('/stats', 
  authorize('admin', 'mentor','author'), 
  authorController.getAuthorStats
);

// Get specific author profile (Admin/Mentor only)
router.get('/:authorId', 
  authorize('admin', 'mentor'), 
  authorController.getAuthorProfile
);

// Update author profile (Admin only)
router.put('/:authorId', 
  authorize('admin'), 
  authorController.updateAuthorProfile
);

// -----------------------------------------------------------------------------
// AUTHOR ANALYTICS
// -----------------------------------------------------------------------------

// Get author analytics (Self, Admin, or Mentor)
router.get('/:authorId/analytics', authorController.getAuthorAnalytics);

// -----------------------------------------------------------------------------
// COLLABORATION MANAGEMENT (Admin/Mentor Only)
// -----------------------------------------------------------------------------

// Search authors for collaboration
router.get('/search/collaborators', 
  authorize('admin', 'mentor'), 
  authorController.searchCollaborators
);

// Add article collaborator
router.post('/collaborations', 
  authorize('admin', 'mentor'), 
  authorController.addArticleCollaborator
);

// Remove article collaborator
router.delete('/collaborations/:articleId/:authorId', 
  authorize('admin', 'mentor'), 
  authorController.removeArticleCollaborator
);

// -----------------------------------------------------------------------------
// ADMIN-ONLY AUTHOR MANAGEMENT
// -----------------------------------------------------------------------------

// Update author status (activate/deactivate)
router.put('/:authorId/status', 
  authorize('admin'), 
  authorController.updateAuthorStatus
);

// Verify author
router.put('/:authorId/verify', 
  authorize('admin'), 
  authorController.verifyAuthor
);

// Delete author
router.delete('/:authorId', 
  authorize('admin'), 
  authorController.deleteAuthor
);

module.exports = router; 