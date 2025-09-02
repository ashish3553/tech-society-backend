const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  input: String,
  expectedOutput: String,
  actualOutput: String,
  status: {
    type: String,
    enum: ['passed', 'failed', 'error', 'pending'],
    default: 'pending'
  },
  executionTime: Number,
  memory: Number,
  weight: { type: Number, default: 1 }
}, { _id: false });

const codeSubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  
  // Code submission details
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    required: true,
    enum: ['javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'php', 'ruby']
  },
  
  // Submission metadata
  isDraft: {
    type: Boolean,
    default: false
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  // Grading and results
  status: {
    type: String,
    enum: ['pending', 'grading', 'graded', 'error'],
    default: 'pending'
  },
  
  // Test results (can be manual or automated)
  testResults: [testResultSchema],
  
  // Scoring
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalTestCases: {
    type: Number,
    default: 0
  },
  passedTestCases: {
    type: Number,
    default: 0
  },
  
  // Manual grading by instructor
  manualGrade: {
    score: Number,
    feedback: String,
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    gradedAt: Date
  },
  
  // Execution details (if any local execution is done)
  executionResult: {
    output: String,
    error: String,
    executionTime: Number,
    memory: Number
  },
  
  // Code analysis
  codeMetrics: {
    linesOfCode: Number,
    complexity: Number,
    hasComments: Boolean,
    hasFunctions: Boolean
  }
}, { timestamps: true });

// Index for quick lookups
codeSubmissionSchema.index({ student: 1, assignment: 1, question: 1 });
codeSubmissionSchema.index({ assignment: 1, question: 1, submittedAt: -1 });

// Pre-save middleware to calculate code metrics
codeSubmissionSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.codeMetrics = {
      linesOfCode: this.code.split('\n').length,
      complexity: this.calculateComplexity(),
      hasComments: this.hasComments(),
      hasFunctions: this.hasFunctions()
    };
  }
  next();
});

// Methods for code analysis
codeSubmissionSchema.methods.calculateComplexity = function() {
  const code = this.code.toLowerCase();
  let complexity = 1; // Base complexity
  
  // Count control structures
  const patterns = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||'];
  patterns.forEach(pattern => {
    complexity += (code.match(new RegExp(pattern, 'g')) || []).length;
  });
  
  return complexity;
};

codeSubmissionSchema.methods.hasComments = function() {
  const code = this.code;
  return /\/\/|\/\*|\*\/|#/.test(code);
};

codeSubmissionSchema.methods.hasFunctions = function() {
  const code = this.code.toLowerCase();
  return /function|def |public |private |protected |void |int |string |class |def\(/.test(code);
};

module.exports = mongoose.model('CodeSubmission', codeSubmissionSchema);
