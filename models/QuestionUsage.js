
// models/QuestionUsage.js
const mongoose = require('mongoose');

const questionUsageSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  assignmentTitle: String, // Cache for quick display
  assignmentType: {
    type: String,
    enum: ['assignment', 'quiz', 'test']
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for quick lookups
questionUsageSchema.index({ question: 1, usedAt: -1 });
questionUsageSchema.index({ assignment: 1 });

module.exports = mongoose.model('QuestionUsage', questionUsageSchema);
