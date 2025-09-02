// models/Question.js - Updated for Phase 2 with explicit coding type separation

const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  // Basic question fields
  type: {
    type: String,
    enum: ['mcq', 'msq', 'descriptive', 'image', 'coding'], // Added 'coding' as explicit type
    required: true
  },
  content: {
    type: String,
    required: true
  },
  
  // MCQ/MSQ specific fields
  options: [{
    id: String,
    text: String
  }],
  correctAnswers: [String],
  
  // All question types can have explanation
  explanation: String,
  
  // Enhanced image support
  images: [{
    url: String,
    caption: String
  }],
  
  // Test cases - now only for coding questions
  testCases: [{
    input: String,
    expected: String,
    weight: {
      type: Number,
      default: 1 // For weighted grading
    }
  }],
  
  // Enhanced tags system
  tags: {
    topics: [String],
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // REMOVED: isCodingQuestion, autoGraded (replaced by explicit type)
  
  // Enhanced platform configuration - only for coding questions
  platformConfig: {
    // Execution platform
    platform: {
      type: String,
      enum: ['internal', 'judge0'],
      default: 'internal'
    },
    
    // Allowed languages
    allowedLanguages: {
      type: [String],
      default: ['python', 'javascript', 'java', 'cpp', 'c']
    },
    
    // Resource limits
    timeLimit: {
      type: Number,
      default: 5 // seconds
    },
    memoryLimit: {
      type: Number,
      default: 128 // MB
    },
    
    // Grading configuration
    gradingType: {
      type: String,
      enum: ['all-or-nothing', 'partial', 'weighted'],
      default: 'all-or-nothing'
    },
    
    // Code templates
    starterCode: {
      type: Map,
      of: String, // { python: "def solution():", javascript: "function solution() {" }
      default: new Map()
    },
    
    // Reference solutions
    solutionCode: {
      type: Map,
      of: String,
      default: new Map()
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
QuestionSchema.index({ type: 1, 'tags.difficulty': 1 });
QuestionSchema.index({ 'tags.topics': 1 });
QuestionSchema.index({ 'tags.creator': 1 });
QuestionSchema.index({ createdAt: -1 });

// Virtual for coding question detection (backward compatibility)
QuestionSchema.virtual('isCodingQuestion').get(function() {
  return this.type === 'coding';
});

QuestionSchema.virtual('autoGraded').get(function() {
  return this.type === 'coding' && this.testCases && this.testCases.length > 0;
});

// Validation middleware
QuestionSchema.pre('save', function(next) {
  // Coding questions must have test cases
  if (this.type === 'coding' && (!this.testCases || this.testCases.length === 0)) {
    return next(new Error('Coding questions must have at least one test case'));
  }
  
  // MCQ/MSQ must have options and correct answers
  if ((this.type === 'mcq' || this.type === 'msq') && (!this.options || this.options.length < 2)) {
    return next(new Error('MCQ/MSQ questions must have at least 2 options'));
  }
  
  if ((this.type === 'mcq' || this.type === 'msq') && (!this.correctAnswers || this.correctAnswers.length === 0)) {
    return next(new Error('MCQ/MSQ questions must have correct answers'));
  }
  
  // MCQ can only have one correct answer
  if (this.type === 'mcq' && this.correctAnswers && this.correctAnswers.length > 1) {
    return next(new Error('MCQ questions can only have one correct answer'));
  }
  
  // Clean up fields based on type
  if (this.type === 'coding') {
    // Coding questions don't need MCQ options
    this.options = undefined;
    this.correctAnswers = undefined;
  } else {
    // Non-coding questions don't need test cases or platform config
    this.testCases = undefined;
    this.platformConfig = undefined;
  }
  
  next();
});

// Methods
QuestionSchema.methods.getGradingConfig = function() {
  if (this.type !== 'coding') return null;
  
  return {
    type: this.platformConfig?.gradingType || 'all-or-nothing',
    weights: this.testCases?.map(tc => tc.weight || 1) || [1],
    totalWeight: this.testCases?.reduce((sum, tc) => sum + (tc.weight || 1), 0) || 1
  };
};

QuestionSchema.methods.getExecutionConfig = function() {
  if (this.type !== 'coding') return null;
  
  return {
    platform: this.platformConfig?.platform || 'internal',
    languages: this.platformConfig?.allowedLanguages || ['python'],
    timeLimit: this.platformConfig?.timeLimit || 5,
    memoryLimit: this.platformConfig?.memoryLimit || 128,
    testCases: this.testCases || []
  };
};

module.exports = mongoose.model('Question', QuestionSchema);