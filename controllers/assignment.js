// controllers/assignment.js
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Session = require('../models/Session'); 

// Import question usage cleanup functions
const QuestionUsage = require('../models/QuestionUsage');
const Question = require('../models/Question');

// Helper functions for question usage tracking
const trackQuestionUsage = async (assignmentId, questionIds, creatorId) => {
  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return;

    const usageRecords = questionIds.map(questionId => ({
      question: questionId,
      assignment: assignmentId,
      assignmentTitle: assignment.title,
      assignmentType: assignment.mode,
      usedBy: creatorId,
      usedAt: new Date()
    }));

    await QuestionUsage.insertMany(usageRecords);

    // Update question usage stats
    await Question.updateMany(
      { _id: { $in: questionIds } },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedIn: assignmentId
        }
      }
    );

    console.log(`Tracked usage for ${questionIds.length} questions in assignment ${assignmentId}`);
  } catch (error) {
    console.error('Error tracking question usage:', error);
  }
};

const cleanupQuestionUsage = async (assignmentId) => {
  try {
    // Find all usage records for this assignment
    const usageRecords = await QuestionUsage.find({ assignment: assignmentId });
    
    if (usageRecords.length === 0) {
      console.log(`No usage records found for assignment ${assignmentId}`);
      return;
    }

    // Get unique question IDs that were used in this assignment
    const questionIds = [...new Set(usageRecords.map(record => record.question.toString()))];
    
    // Delete all usage records for this assignment
    const deleteResult = await QuestionUsage.deleteMany({ assignment: assignmentId });
    console.log(`Deleted ${deleteResult.deletedCount} usage records for assignment ${assignmentId}`);

    // Update question usage stats
    for (const questionId of questionIds) {
      // Count remaining usage for each question
      const remainingUsageCount = await QuestionUsage.countDocuments({ question: questionId });
      
      // Find the most recent usage (if any)
      const mostRecentUsage = await QuestionUsage.findOne({ question: questionId })
        .sort({ usedAt: -1 });

      // Update question with new stats
      const updateData = {
        usageCount: remainingUsageCount,
        lastUsedAt: mostRecentUsage ? mostRecentUsage.usedAt : null,
        lastUsedIn: mostRecentUsage ? mostRecentUsage.assignment : null
      };

      await Question.findByIdAndUpdate(questionId, updateData);
    }

    console.log(`Updated usage stats for ${questionIds.length} questions after deleting assignment ${assignmentId}`);
    
    return {
      deletedUsageRecords: deleteResult.deletedCount,
      updatedQuestions: questionIds.length
    };

  } catch (error) {
    console.error('Error cleaning up question usage:', error);
    throw error;
  }
};

const updateQuestionUsage = async (assignmentId, oldQuestionIds = [], newQuestionIds = [], creatorId) => {
  try {
    // Find questions that were removed
    const removedQuestionIds = oldQuestionIds.filter(id => !newQuestionIds.includes(id));
    
    // Find questions that were added
    const addedQuestionIds = newQuestionIds.filter(id => !oldQuestionIds.includes(id));

    // Remove usage for questions that were removed from assignment
    if (removedQuestionIds.length > 0) {
      await QuestionUsage.deleteMany({
        assignment: assignmentId,
        question: { $in: removedQuestionIds }
      });

      // Update usage counts for removed questions
      for (const questionId of removedQuestionIds) {
        const remainingUsageCount = await QuestionUsage.countDocuments({ question: questionId });
        const mostRecentUsage = await QuestionUsage.findOne({ question: questionId })
          .sort({ usedAt: -1 });

        await Question.findByIdAndUpdate(questionId, {
          usageCount: remainingUsageCount,
          lastUsedAt: mostRecentUsage ? mostRecentUsage.usedAt : null,
          lastUsedIn: mostRecentUsage ? mostRecentUsage.assignment : null
        });
      }
      
      console.log(`Removed usage tracking for ${removedQuestionIds.length} questions`);
    }

    // Add usage for new questions
    if (addedQuestionIds.length > 0) {
      await trackQuestionUsage(assignmentId, addedQuestionIds, creatorId);
      console.log(`Added usage tracking for ${addedQuestionIds.length} questions`);
    }

    return {
      removed: removedQuestionIds.length,
      added: addedQuestionIds.length
    };

  } catch (error) {
    console.error('Error updating question usage:', error);
    throw error;
  }
};

// @desc Create a new assignment
exports.createAssignment = async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user.id
    };
    const assignment = await Assignment.create(data);

    // Track question usage - EXISTING CODE MAINTAINED
    if (assignment.questions && assignment.questions.length > 0) {
      await trackQuestionUsage(assignment._id, assignment.questions, req.user.id);
    }

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
};

// @desc Get all assignments (filter for students)
exports.getAssignments = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'student') {
      filter = {
        $or: [
          { visibleToAll: true },
          { visibleTo: req.user.id }
        ]
      };
    }
    const assignments = await Assignment.find(filter)
      .populate('questions','content type')
      .populate('createdBy','name email');
    res.json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
};

// @desc Student "My Assignments"
// @desc Student "My Assignments"
exports.getMyAssignments = async (req, res, next) => {
  try {
    const me = req.user.id;

    const assigns = await Assignment.find({
      isDispatched: true,
      $or: [{ visibleToAll: true }, { visibleTo: me }],
    })
      .select('title startDate dueDate mode timeLimitMinutes visibleToAll createdBy questions')
      .populate('createdBy', 'name')
      .lean();

    const subs = await Submission.find({
      assignment: { $in: assigns.map((a) => a._id) },
      student: me,
    }).lean();

    const subMap = {};
    subs.forEach((s) => (subMap[s.assignment.toString()] = s));

    const now = new Date();

    const data = await Promise.all(
      (assigns || []).map(async (a) => {
        const sub = subMap[a._id.toString()] || null;

        // base status
        let studentStatus;
        if (!sub) {
          if (a.startDate && now < a.startDate) studentStatus = 'upcoming';
          else if (a.dueDate && now > a.dueDate) studentStatus = 'closed';
          else studentStatus = 'pending';
        } else {
          const hasManual = (a.questions || []).some((q) => q.type === 'descriptive');
          studentStatus = hasManual && sub.isFinal === false ? 'pendingReview' : 'completed';
        }

        // session awareness for quiz/test
        let sessionData = null;
        if (['quiz', 'test'].includes(a.mode)) {
          const activeSession = await Session.findActiveSession(me, a._id);
          if (activeSession) {
            sessionData = {
              sessionId: activeSession._id,
              timeRemaining: activeSession.getRemainingTime(),
              isActive: activeSession.isActive,
              startedAt: activeSession.startedAt,
              expiresAt: activeSession.expiresAt,
            };
            // if there's an active session, override status
            studentStatus = 'in-progress';
          }
        }

        return {
          _id: a._id,
          title: a.title,
          startDate: a.startDate,
          dueDate: a.dueDate,
          mode: a.mode,
          timeLimitMinutes: a.timeLimitMinutes,
          visibleToAll: a.visibleToAll,
          createdBy: a.createdBy,
          questionsCount: (a.questions || []).length,
          studentStatus,
          hasActiveSession: sessionData?.isActive || false,
          timeRemaining: sessionData?.timeRemaining || 0,
          sessionData,
          mySubmission: sub,
        };
      })
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
 


// @desc Get single assignment (with same visibility check)
exports.getAssignment = async (req, res, next) => {
  try {
   const a = await Assignment.findById(req.params.id)
     .populate('questions')
      .populate('visibleTo','name email')
      .populate('createdBy','name email')
   if (!a) return res.status(404).json({ success:false, message:'Not found' })
   res.json({ success:true, data:a })
  } catch (err) {
    next(err)
  }
}

exports.getMySubmission = async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    const studentId    = req.user.id;
    const sub = await Submission.findOne({
      assignment: assignmentId,
      student:    studentId
    });
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: 'No submission found' });
    }
    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
};

// @desc Update an assignment - MODIFIED WITH USAGE TRACKING
exports.updateAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get current assignment to compare questions
    const currentAssignment = await Assignment.findById(id);
    if (!currentAssignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check permission (basic check - adjust as needed)
    if (req.user.role !== 'admin' && currentAssignment.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this assignment' });
    }

    const oldQuestionIds = (currentAssignment.questions || []).map(id => id.toString());
    const newQuestionIds = (req.body.questions || []).map(id => id.toString());

    // Update the assignment
    for (const key of Object.keys(req.body)) {
      currentAssignment[key] = req.body[key];
    }
    await currentAssignment.save();

    // Update question usage tracking if questions changed
    if (JSON.stringify(oldQuestionIds.sort()) !== JSON.stringify(newQuestionIds.sort())) {
      try {
        const usageUpdateResult = await updateQuestionUsage(
          id, 
          oldQuestionIds, 
          newQuestionIds, 
          req.user.id
        );
        console.log(`Usage update result for assignment ${id}:`, usageUpdateResult);
      } catch (usageError) {
        console.error('Warning: Failed to update question usage:', usageError);
        // Continue even if usage update fails
      }
    }

    res.json({ success: true, data: currentAssignment });
  } catch (err) {
    next(err);
  }
};

// @desc Delete an assignment - MODIFIED WITH USAGE CLEANUP
exports.deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if assignment exists
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check permission (basic check - adjust as needed)
    if (req.user.role !== 'admin' && assignment.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this assignment' });
    }

    // Clean up question usage tracking BEFORE deleting assignment
    try {
      const cleanupResult = await cleanupQuestionUsage(id);
      console.log(`Cleanup result for assignment ${id}:`, cleanupResult);
    } catch (cleanupError) {
      console.error('Warning: Failed to cleanup question usage:', cleanupError);
      // Continue with deletion even if cleanup fails
    }

    // Delete the assignment
    await Assignment.findByIdAndDelete(id);

    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc Student submits assignment
exports.submitAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const {
      answers = [],
      testCaseResults = [],
      isFinal = true,
      timeTakenMs = null
    } = req.body;

    // 1) Fetch the assignment and its questions
    const assignment = await Assignment.findById(id).populate('questions');
    if (!assignment) {
      return res.status(404).json({ success:false, message:'Assignment not found' });
    }

    // 2) Check visibility (public or explicitly granted)
    if (
      !assignment.visibleToAll &&
      !assignment.visibleTo.some(u => u.toString() === studentId)
    ) {
      return res.status(403).json({ success:false, message:'Forbidden' });
    }

    // 3) If this is a final submission AND there are no descriptive questions, auto-grade
    let grade = null;
    const hasManual = assignment.questions.some(q => q.type === 'descriptive');
    if (isFinal && !hasManual) {
      grade = assignment.questions.reduce((count, q) => {
        if (!['mcq','msq'].includes(q.type)) return count;
        const ans = answers.find(a => a.question.toString() === q._id.toString());
        if (!ans) return count;
        const resp = ans.response;
        const correct = q.type === 'mcq'
          ? q.correctAnswers.includes(resp)
          : Array.isArray(resp)
            && resp.length === q.correctAnswers.length
            && resp.every(r => q.correctAnswers.includes(r));
        return correct ? count + 1 : count;
      }, 0);
    }

    // 4) Upsert the submission (draft or final)
    const submission = await Submission.findOneAndUpdate(
      { assignment: id, student: studentId },
      {
        $set: {
          answers,
          testCaseResults,
          grade,
          isFinal,
          timeTakenMs,
          submittedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    return res.json({ success:true, data: submission });
  } catch (err) {
    next(err);
  }
};

// @desc Mentor/Admin: list all submissions
exports.getSubmissions = async (req, res, next) => {
  try {
    const a = await Assignment.findById(req.params.id)
      .populate('submissions.student','name email');
    if (!a) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data: a.submissions });
  } catch (err) {
    next(err);
  }
}

// @desc Mentor/Admin: get one student's submission
exports.getSubmission = async (req, res, next) => {
  try {
    const a = await Assignment.findById(req.params.id)
      .populate('submissions.student','name email');
    if (!a) return res.status(404).json({ success:false, message:'Not found' });

    const sub = a.submissions.find(
      s => s.student._id.toString() === req.params.studentId
    );
    if (!sub) {
      return res.status(404).json({ success:false, message:'Submission not found' });
    }
    res.json({ success:true, data: sub });
  } catch (err) {
    next(err);
  }
}

// @desc Mentor/Admin: grade a student's submission
exports.gradeSubmission = async (req, res, next) => {
  try {
    const { id, studentId } = req.params;
    const { grade, feedback, answers: answerUpdates } = req.body;

    const a = await Assignment.findById(id);
    if (!a) return res.status(404).json({ success:false, message:'Assignment not found' });

    // Find submission index
    const idx = a.submissions.findIndex(s => s.student.toString() === studentId);
    if (idx < 0) return res.status(404).json({ success:false, message:'Submission not found' });

    // Update per-answer correctness if provided
    if (Array.isArray(answerUpdates)) {
      a.submissions[idx].answers = a.submissions[idx].answers.map(ansDoc => {
        const upd = answerUpdates.find(u => u.question === ansDoc.question.toString());
        if (upd && typeof upd.isCorrect === 'boolean') {
          ansDoc.isCorrect = upd.isCorrect;
        }
        return ansDoc;
      });
    }

    // Update grade & feedback
    if (typeof grade === 'number')     a.submissions[idx].grade    = grade;
    if (typeof feedback === 'string')  a.submissions[idx].feedback = feedback;

    await a.save();

    // Respond with the updated submission
    const updated = a.submissions[idx].toObject();
    res.json({ success:true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.getRankings = async (req, res, next) => {
  try {
    const { id } = req.params
    const subs = await Submission.find({ assignment: id, isFinal: true })
      .populate('student', 'name')
      .lean()

    // sort descending by grade
    subs.sort((a, b) => b.grade - a.grade)

    // assign ranks, tie = same rank, then skip
    let lastScore = null, lastRank = 0
    const rankings = subs.map((s, idx) => {
      if (s.grade !== lastScore) {
        lastRank = idx + 1
        lastScore = s.grade
      }
      return {
        student: s.student.name,
        grade: s.grade,
        rank: lastRank
      }
    })

    res.json({ success: true, data: rankings })
  } catch (err) {
    next(err)
  }
}

// @desc Dispatch an assignment/quiz/test so students can see+attempt it
exports.dispatchAssignment = async (req, res, next) => {
  try {
    const a = await Assignment.findById(req.params.id)
    if (!a) return res.status(404).json({ success:false, message:'Not found' })

    a.isDispatched = true
    a.dispatchDate = new Date()
    await a.save()

    res.json({ success:true, data: a })
  } catch(err) {
    next(err)
  }
}

// @desc Pull back assignment so students can't see it
exports.undispatchAssignment = async (req, res, next) => {
  try {
    const a = await Assignment.findById(req.params.id)
    if (!a) return res.status(404).json({ success:false, message:'Not found' })
    a.isDispatched = false
    a.dispatchDate = null
    await a.save()
    res.json({ success:true, data:a })
  } catch (err) { next(err) }
}


// Get detailed submission for a student (for mentor dashboard)
exports.getSubmissionDetail = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    
    // Verify assignment exists and get it with questions populated
    const assignment = await Assignment.findById(assignmentId)
      .populate({
        path: 'questions',
        select: 'type content options correctAnswers testCases explanation'
      });
    
    if (!assignment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Assignment not found' 
      });
    }
    
    // Get student's final submission
    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId,
      isFinal: true
    }).populate('student', 'name email');
    
    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        message: 'Submission not found' 
      });
    }
    
    // Return detailed submission data
    res.json({
      success: true,
      data: {
        assignmentTitle: assignment.title,
        assignmentId: assignment._id,
        studentId: studentId,
        questions: assignment.questions,
        answers: submission.answers,
        grade: submission.grade || 0,
        submittedAt: submission.submittedAt,
        feedback: submission.feedback
      }
    });
    
  } catch (error) {
    console.error('Error fetching submission detail:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};