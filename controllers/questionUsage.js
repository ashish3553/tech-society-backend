const QuestionUsage = require('../models/QuestionUsage');
const Question = require('../models/Question');



// Get question usage history
exports.getQuestionUsageHistory = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    
    const usageHistory = await QuestionUsage.find({ question: questionId })
      .populate('assignment', 'title mode createdAt')
      .populate('usedBy', 'name email')
      .sort({ usedAt: -1 });

    const question = await Question.findById(questionId);
    
    res.json({
      success: true,
      data: {
        question: question?.content?.substring(0, 100) + '...',
        totalUsage: usageHistory.length,
        history: usageHistory
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get questions with usage stats
exports.getQuestionsWithUsage = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, showUnused = false } = req.query;
    console.log("hit this controler")
    
    // Aggregation pipeline to get questions with usage stats
    const pipeline = [
      {
        $lookup: {
          from: 'questionusages',
          localField: '_id',
          foreignField: 'question',
          as: 'usageHistory'
        }
      },
      {
        $addFields: {
          usageCount: { $size: '$usageHistory' },
          lastUsage: { $max: '$usageHistory.usedAt' },
          recentUsage: {
            $filter: {
              input: '$usageHistory',
              cond: {
                $gte: ['$$this.usedAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)]
              }
            }
          }
        }
      },
      {
        $addFields: {
          recentUsageCount: { $size: '$recentUsage' }
        }
      }
    ];

    // Filter unused questions if requested
    if (showUnused === 'true') {
      pipeline.push({ $match: { usageCount: 0 } });
    }

    // Sort by usage count (ascending) and creation date
    pipeline.push({
      $sort: { usageCount: 1, createdAt: -1 }
    });

    // Add pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Populate creator
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'tags.creator',
        foreignField: '_id',
        as: 'tags.creator'
      }
    });

    const questions = await Question.aggregate(pipeline);
    
    res.json({
      success: true,
      data: questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: questions.length === parseInt(limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Track question usage when assignment is created
exports.trackQuestionUsage = async (assignmentId, questionIds, creatorId) => {
  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return;

    const usageRecords = questionIds.map(questionId => ({
      question: questionId,
      assignment: assignmentId,
      assignmentTitle: assignment.title,
      assignmentType: assignment.mode,
      usedBy: creatorId
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
  } catch (error) {
    console.error('Error tracking question usage:', error);
  }
};