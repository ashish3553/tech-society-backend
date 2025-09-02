// controllers/codeSubmissionController.js - FIXED: Complete backend integration with test execution

const CodeSubmission = require('../models/CodeSubmission');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');
const pistonService = require('../services/pistonService'); // ADD THIS IMPORT

// -------------------------------------------------------------
// FIXED: Submit code (final submission) with actual test execution
// -------------------------------------------------------------
exports.submitCode = async (req, res, next) => {
  try {
    const { assignmentId, questionId, code, language } = req.body;
    const studentId = req.user.id;

    // Validate inputs
    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code cannot be empty',
      });
    }

    if (!assignmentId || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and Question ID are required',
      });
    }

    // Get question and assignment details
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found',
      });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    // Check if assignment is still active (deadline)
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Assignment deadline has passed',
      });
    }

    // Find existing final submission to update, or create a new one
    let existingFinalSubmission = await CodeSubmission.findOne({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      isDraft: false,
    });

    let submission;
    const totalTestCases = Array.isArray(question.testCases) ? question.testCases.length : 0;

    if (existingFinalSubmission) {
      // Update existing final submission
      existingFinalSubmission.code = code.trim();
      existingFinalSubmission.language = language;
      existingFinalSubmission.submittedAt = new Date();
      existingFinalSubmission.status = 'grading';
      existingFinalSubmission.totalTestCases = totalTestCases;
      await existingFinalSubmission.save();
      submission = existingFinalSubmission;
    } else {
      // Create new final submission
      submission = new CodeSubmission({
        student: studentId,
        assignment: assignmentId,
        question: questionId,
        code: code.trim(),
        language,
        isDraft: false,
        totalTestCases,
        status: 'grading',
        submittedAt: new Date(),
      });
      await submission.save();
    }

    // Always remove drafts once final submission is made
    await CodeSubmission.deleteMany({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      isDraft: true,
    });

    // -------- Execute against test cases (if any) --------
    let executionResults = null;
    let finalScore = 0; // percentage 0..100
    let passedCount = 0;
    let testResults = [];

    if (totalTestCases > 0) {
      try {
        executionResults = await pistonService.executeWithTestCases(
          language,
          code.trim(),
          question.testCases
        );

        // ALSO FIX: Proper status mapping and all-or-nothing scoring
        if (executionResults && executionResults.testResults) {
          testResults = executionResults.testResults.map((result) => ({
            ...result,
            status:
              result.passed ||
              result.actualOutput === result.expectedOutput
                ? 'passed'
                : 'failed',
          }));

          passedCount = testResults.filter((r) => r.status === 'passed').length;

          // All-or-nothing: 100% if ALL passed, else 0%
          finalScore = passedCount === totalTestCases ? 100 : 0;

          console.log(
            `Execution completed: ${passedCount}/${totalTestCases} tests passed, final score: ${finalScore}%`
          );
        } else {
          console.log('Execution failed or returned no results');
          finalScore = 0;
          passedCount = 0;
          testResults = [];
        }
      } catch (executionError) {
        console.error('Code execution error:', executionError);
        // Even if execution fails, we still record the attempt
        finalScore = 0;
        passedCount = 0;
        testResults = [];
      }
    } else {
      console.log('No test cases found for question, marking as attempted with 0 score');
    }

    // Update submission with results and mark graded
    submission.score = finalScore; // percent
    submission.actualScore = finalScore / 100; // 0 or 1
    submission.passedTestCases = passedCount;
    submission.totalTestCases = totalTestCases;
    submission.testResults = testResults;
    submission.status = 'graded';

    await submission.save();

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission._id,
        code: submission.code,
        language: submission.language,
        submittedAt: submission.submittedAt,
        totalTestCases: submission.totalTestCases,
        status: 'graded',
        score: finalScore, // percent
        passedTestCases: passedCount,
        testResults,
        actualScore: finalScore / 100, // 0 or 1
        isAttempt: true,
      },
      message: existingFinalSubmission
        ? `Code resubmitted successfully! Score: ${finalScore}% (${passedCount}/${totalTestCases} tests passed)`
        : `Code submitted successfully! Score: ${finalScore}% (${passedCount}/${totalTestCases} tests passed)`,
    });
  } catch (error) {
    console.error('Code submission error:', error);
    next(error);
  }
};

// -------------------------------------------------------------
// FIXED: Save code as draft with better logic
// -------------------------------------------------------------
exports.saveDraft = async (req, res, next) => {
  try {
    const { assignmentId, questionId, code, language } = req.body;
    const studentId = req.user.id;

    if (!assignmentId || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and Question ID are required',
      });
    }

    // Do not store empty code as a draft
    if (!code || !code.trim()) {
      return res.json({
        success: true,
        message: 'No code to save',
      });
    }

    // Prevent drafts after final submission exists
    const finalSubmission = await CodeSubmission.findOne({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      isDraft: false,
    });

    if (finalSubmission) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save draft after final submission',
      });
    }

    let draft = await CodeSubmission.findOne({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
      isDraft: true,
    });

    if (draft) {
      draft.code = code.trim();
      draft.language = language || 'python';
      draft.submittedAt = new Date();
    } else {
      draft = new CodeSubmission({
        student: studentId,
        assignment: assignmentId,
        question: questionId,
        code: code.trim(),
        language: language || 'python',
        isDraft: true,
        submittedAt: new Date(),
      });
    }

    await draft.save();

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: {
        draftId: draft._id,
        savedAt: draft.submittedAt,
        code: draft.code,
        language: draft.language,
      },
    });
  } catch (error) {
    console.error('Draft save error:', error);
    next(error);
  }
};

// -------------------------------------------------------------
// FIXED: Get submissions with better filtering and population
// -------------------------------------------------------------
exports.getSubmissions = async (req, res, next) => {
  try {
    const { assignmentId, questionId, student, includeDrafts } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const query = {};
    if (assignmentId) query.assignment = assignmentId;
    if (questionId) query.question = questionId;

    if (userRole === 'student') {
      query.student = userId; // students only see their own
    } else if (student) {
      query.student = student;
    }

    if (userRole !== 'student') {
      // mentors/admins see only finals unless drafts explicitly requested
      if (includeDrafts !== 'true') {
        query.isDraft = false;
      }
    }
    // students get both drafts and finals by default

    const submissions = await CodeSubmission.find(query)
      .populate('student', 'name email')
      .populate('question', 'content type testCases')
      .populate('assignment', 'title mode')
      .sort({ submittedAt: -1 });

    // Optional grouped view for convenience (kept for compatibility)
    const groupedSubmissions = submissions.reduce((acc, submission) => {
      const q = submission.question;
      const key = q?._id ? String(q._id) : String(submission.question);
      if (!acc[key]) {
        acc[key] = { question: q || submission.question, submissions: [] };
      }
      acc[key].submissions.push(submission);
      return acc;
    }, {});

    res.json({
      success: true,
      data: submissions, // flat array
      grouped: groupedSubmissions, // grouped companion
    });
  } catch (error) {
    console.error('Get submissions error:', error);
    next(error);
  }
};

// -------------------------------------------------------------
// FIXED: Get single submission with full details
// -------------------------------------------------------------
exports.getSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const submission = await CodeSubmission.findById(submissionId)
      .populate('student', 'name email branch year')
      .populate('question', 'content type testCases explanation')
      .populate('assignment', 'title mode dueDate');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (userRole === 'student' && String(submission.student._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error('Get submission error:', error);
    next(error);
  }
};

// -------------------------------------------------------------
// Manual grading by instructor
// -------------------------------------------------------------
exports.gradeSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;
    const graderId = req.user.id;

    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'Score must be a number between 0 and 100',
      });
    }

    const submission = await CodeSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    submission.manualGrade = {
      score,
      feedback,
      gradedBy: graderId,
      gradedAt: new Date(),
    };

    submission.score = score;
    submission.actualScore = score / 100;
    submission.status = 'graded';

    await submission.save();

    await submission.populate([
      { path: 'manualGrade.gradedBy', select: 'name email' },
      { path: 'student', select: 'name email' },
    ]);

    res.json({
      success: true,
      message: 'Submission graded successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Manual grading error:', error);
    next(error);
  }
};

// -------------------------------------------------------------
// Get latest submission for a question (draft or final)
// -------------------------------------------------------------
exports.getLatestSubmission = async (req, res, next) => {
  try {
    const { assignmentId, questionId } = req.query;
    const studentId = req.user.id;

    if (!assignmentId || !questionId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and Question ID are required',
      });
    }

    const latestSubmission = await CodeSubmission.findOne({
      student: studentId,
      assignment: assignmentId,
      question: questionId,
    })
      .sort({ submittedAt: -1 })
      .populate('question', 'content testCases')
      .populate('assignment', 'title');

    if (!latestSubmission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found',
      });
    }

    res.json({
      success: true,
      data: latestSubmission,
    });
  } catch (error) {
    console.error('Get latest submission error:', error);
    next(error);
  }
};

module.exports = {
  submitCode: exports.submitCode,
  saveDraft: exports.saveDraft,
  getSubmissions: exports.getSubmissions,
  getSubmission: exports.getSubmission,
  gradeSubmission: exports.gradeSubmission,
  getLatestSubmission: exports.getLatestSubmission,
};
