// routes/questionUsage.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const questionUsageController = require('../controllers/questionUsage');

// All routes require authentication
router.use(auth);

// 1️⃣ Question-selection usage stats
//    GET /api/questions/usage-stats

console.log("hdsndjknadslfjksadn flkj");
router.get(
  '/usage-stats',
  questionUsageController.getQuestionsWithUsage
);

// 2️⃣ Per-question history
//    GET /api/questions/:questionId/usage-history
router.get(
  '/:questionId/usage-history',
  questionUsageController.getQuestionUsageHistory
);

// 3️⃣ Admin/Mentor analytics summary
//    GET /api/questions/analytics/usage-summary
router.get(
  '/analytics/usage-summary',
  authorize('admin', 'mentor'),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      
      const pipeline = [
        {
          $match: {
            usedAt: {
              $gte: startDate
                ? new Date(startDate)
                : new Date(Date.now() - 30 * 24*60*60*1000),
              $lte: endDate ? new Date(endDate) : new Date()
            }
          }
        },
        {
          $group: {
            _id: '$question',
            usageCount: { $sum: 1 },
            lastUsed: { $max: '$usedAt' },
            assignments: { $addToSet: '$assignment' }
          }
        },
        {
          $lookup: {
            from: 'questions',
            localField: '_id',
            foreignField: '_id',
            as: 'question'
          }
        },
        { $unwind: '$question' },
        { $sort: { usageCount: -1 } },
        { $limit: 20 }
      ];
 
      const QuestionUsage = require('../models/QuestionUsage');
      const topUsedQuestions = await QuestionUsage.aggregate(pipeline);
      
      const Question = require('../models/Question');
      const totalQuestions    = await Question.countDocuments();
      const usedQuestions     = await QuestionUsage.distinct('question');
      const usedQuestionsCount = usedQuestions.length;
      const unusedQuestionsCount = totalQuestions - usedQuestionsCount;

      res.json({
        success: true,
        data: {
          topUsedQuestions,
          totalQuestions,
          usedQuestionsCount,
          unusedQuestionsCount,
          utilizationRate: Math.round((usedQuestionsCount/totalQuestions)*100)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
