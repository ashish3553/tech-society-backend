const mongoose = require('mongoose');

const ArticleCommentSchema = new mongoose.Schema({
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  
  // Comment threading
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'ArticleComment' },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ArticleComment' }],
  
  // Engagement
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Moderation
  isApproved: { type: Boolean, default: true },
  isEdited: { type: Boolean, default: false },
  editedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('ArticleComment', ArticleCommentSchema);