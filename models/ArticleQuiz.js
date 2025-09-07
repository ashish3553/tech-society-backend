const mongoose = require('mongoose');

const ArticleQuizSchema = new mongoose.Schema({
  title: String,
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
  
  // Quiz settings
  showImmediateFeedback: { type: Boolean, default: true },
  allowRetakes: { type: Boolean, default: true },
  passingScore: { type: Number, default: 70 },
  
  // Results tracking
  attempts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answers: [{
      question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      response: mongoose.Schema.Types.Mixed
    }],
    score: Number,
    completedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('ArticleQuiz', ArticleQuizSchema);