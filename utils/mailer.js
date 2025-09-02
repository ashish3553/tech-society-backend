// server/utils/mailer.js
const mailjet = require('node-mailjet')
  .apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
  )

const sendEmail = async ({ to, subject, text, html, from }) => {
  let recipients
  if (Array.isArray(to)) {
    recipients = to
  } else if (typeof to === 'string') {
    recipients = to.split(',').map(email => ({ Email: email.trim() }))
  } else {
    throw new Error('Invalid "to" field provided.')
  }

  try {
    const { body } = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: from || process.env.DEFAULT_FROM_EMAIL,
              Name: 'CodeIndia'
            },
            To: recipients,
            Subject: subject,
            TextPart: text,
            HTMLPart: html
          }
        ]
      })
    console.log('Mailjet response:', body)
    return body
  } catch (err) {
    console.error('Mailjet error:', err.statusCode, err.message)
    throw err
  }
}

module.exports = sendEmail
// ===========================================================
// models/CodeSubmission.js - Updated for Monaco Editor
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

// controllers/codeSubmissionController.js - Updated for Monaco Editor
const CodeSubmission = require('../models/CodeSubmission');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');

// Submit code (final submission)
exports.submitCode = async (req, res, next) => {
  try {
    const { assignmentId, questionId, code, language } = req.body;
    const studentId = req.user.id;

    // Validate inputs
    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code cannot be empty'
      });
    }

    // Get question details
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Check if assignment is still active
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Assignment deadline has passed'
      });
    }

    // Create submission record
    const submission = new CodeSubmission({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      code: code.trim(),
      language,
      isDraft: false,
      totalTestCases: question.testCases?.length || 0,
      status: 'pending'
    });

    // Basic code validation and scoring
    const { score, testResults } = await evaluateCodeSubmission(submission, question);
    
    submission.score = score;
    submission.passedTestCases = testResults.filter(r => r.status === 'passed').length;
    submission.testResults = testResults;
    submission.status = 'graded';

    await submission.save();

    // Populate the response
    await submission.populate([
      { path: 'student', select: 'name email' },
      { path: 'question', select: 'content testCases' }
    ]);

    res.json({
      success: true,
      data: {
        submissionId: submission._id,
        score: submission.score,
        passedTestCases: submission.passedTestCases,
        totalTestCases: submission.totalTestCases,
        testResults: submission.testResults,
        submittedAt: submission.submittedAt,
        codeMetrics: submission.codeMetrics
      }
    });

  } catch (error) {
    next(error);
  }
};

// Save code as draft
exports.saveDraft = async (req, res, next) => {
  try {
    const { assignmentId, questionId, code, language } = req.body;
    const studentId = req.user.id;

    // Find existing draft or create new one
    let draft = await CodeSubmission.findOne({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      isDraft: true
    });

    if (draft) {
      // Update existing draft
      draft.code = code;
      draft.language = language;
      draft.submittedAt = new Date();
    } else {
      // Create new draft
      draft = new CodeSubmission({
        student: studentId,
        assignment: assignmentId,
        question: questionId,
        code,
        language,
        isDraft: true
      });
    }

    await draft.save();

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: {
        draftId: draft._id,
        savedAt: draft.submittedAt
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get submissions for a student
exports.getSubmissions = async (req, res, next) => {
  try {
    const { assignmentId, questionId, student } = req.query;
    const userId = req.user.id;

    // Build query
    const query = {};
    if (assignmentId) query.assignment = assignmentId;
    if (questionId) query.question = questionId;
    
    // Students can only see their own submissions
    if (req.user.role === 'student') {
      query.student = userId;
    } else if (student) {
      query.student = student;
    }

    // Only get final submissions (not drafts) unless specifically requested
    if (req.query.includeDrafts !== 'true') {
      query.isDraft = false;
    }

    const submissions = await CodeSubmission.find(query)
      .populate('student', 'name email')
      .populate('question', 'content type')
      .populate('assignment', 'title')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: submissions
    });

  } catch (error) {
    next(error);
  }
};

// Manual grading by instructor
exports.gradeSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;
    const graderId = req.user.id;

    // Validate inputs
    if (score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'Score must be between 0 and 100'
      });
    }

    const submission = await CodeSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Update manual grading
    submission.manualGrade = {
      score,
      feedback,
      gradedBy: graderId,
      gradedAt: new Date()
    };

    // Update overall score (you can customize this logic)
    submission.score = score;
    submission.status = 'graded';

    await submission.save();

    await submission.populate([
      { path: 'manualGrade.gradedBy', select: 'name email' },
      { path: 'student', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Submission graded successfully',
      data: submission
    });

  } catch (error) {
    next(error);
  }
};

// Basic code evaluation function (without external APIs)
async function evaluateCodeSubmission(submission, question) {
  const testResults = [];
  let passedCount = 0;

  // If no test cases, give basic score based on code quality
  if (!question.testCases || question.testCases.length === 0) {
    const baseScore = calculateCodeQualityScore(submission.code, submission.language);
    return {
      score: baseScore,
      testResults: []
    };
  }

  // Process each test case
  for (const testCase of question.testCases) {
    const result = {
      input: testCase.input,
      expectedOutput: testCase.expected,
      actualOutput: '',
      status: 'pending'
    };

    // Basic JavaScript execution (limited and unsafe - for demo only)
    if (submission.language === 'javascript') {
      try {
        result.actualOutput = await executeJavaScriptCode(submission.code, testCase.input);
        result.status = result.actualOutput.trim() === testCase.expected.trim() ? 'passed' : 'failed';
      } catch (error) {
        result.actualOutput = `Error: ${error.message}`;
        result.status = 'error';
      }
    } else {
      // For other languages, mark as pending manual review
      result.status = 'pending';
      result.actualOutput = 'Manual review required';
    }

    if (result.status === 'passed') {
      passedCount++;
    }

    testResults.push(result);
  }

  // Calculate score
  const testScore = question.testCases.length > 0 ? 
    (passedCount / question.testCases.length) * 80 : 0; // 80% for test cases
  const qualityScore = calculateCodeQualityScore(submission.code, submission.language) * 0.2; // 20% for quality
  
  const finalScore = Math.round(testScore + qualityScore);

  return {
    score: Math.min(finalScore, 100),
    testResults
  };
}

// Basic JavaScript code execution (UNSAFE - for demo only)
async function executeJavaScriptCode(code, input) {
  // WARNING: This is unsafe and should not be used in production
  // It's only for demonstration purposes
  
  try {
    // Create a very basic execution environment
    const func = new Function('input', `
      ${code}
      
      // Try to find and call a main function or return result
      if (typeof solve === 'function') {
        return solve(input);
      } else if (typeof main === 'function') {
        return main(input);
      } else {
        // Just return the input for now
        return input;
      }
    `);
    
    const result = func(input);
    return String(result);
  } catch (error) {
    throw new Error(`Execution error: ${error.message}`);
  }
}

// Calculate code quality score
function calculateCodeQualityScore(code, language) {
  let score = 0;
  const lines = code.split('\n');
  
  // Length appropriateness (not too short, not too long)
  if (lines.length >= 5 && lines.length <= 100) score += 20;
  else if (lines.length >= 3) score += 10;
  
  // Has comments
  if (/\/\/|\/\*|\*\/|#/.test(code)) score += 20;
  
  // Has functions/methods
  if (/function|def |public |private |class/.test(code)) score += 20;
  
  // Proper indentation
  const indentedLines = lines.filter(line => line.match(/^\s+\S/));
  if (indentedLines.length > 0) score += 20;
  
  // No obvious syntax errors (basic check)
  const hasBasicStructure = /[\{\}\(\)\[\]]/g.test(code);
  if (hasBasicStructure) score += 20;
  
  return score;
}

module.exports = {
  submitCode: exports.submitCode,
  saveDraft: exports.saveDraft,
  getSubmissions: exports.getSubmissions,
  gradeSubmission: exports.gradeSubmission
};

// routes/codeSubmission.js - Updated routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const codeSubmissionController = require('../controllers/codeSubmissionController');

// All routes require authentication
router.use(auth);

// Student routes
router.post('/code-submissions', codeSubmissionController.submitCode);
router.post('/code-submissions/draft', codeSubmissionController.saveDraft);
router.get('/code-submissions', codeSubmissionController.getSubmissions);

// Instructor routes for manual grading
router.put('/code-submissions/:submissionId/grade', 
  authorize('admin', 'mentor'), 
  codeSubmissionController.gradeSubmission
);

// Get submissions for grading (admin/mentor only)
router.get('/code-submissions/grading',
  authorize('admin', 'mentor'),
  async (req, res, next) => {
    try {
      const { assignmentId, questionId } = req.query;
      
      const submissions = await require('../models/CodeSubmission')
        .find({
          assignment: assignmentId,
          question: questionId,
          isDraft: false
        })
        .populate('student', 'name email')
        .populate('question', 'content')
        .sort({ submittedAt: -1 });

      res.json({
        success: true,
        data: submissions
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

// server.js - Add the new route
// Add this line to your server.js:
const codeSubmissionRoutes = require('./routes/codeSubmission');
app.use('/api', codeSubmissionRoutes);

// Package.json dependencies to add:
/*
npm install @monaco-editor/react
*/