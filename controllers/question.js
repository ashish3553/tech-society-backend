const Question = require('../models/Question');

// UPDATE: createQuestion function
exports.createQuestion = async (req, res, next) => {
  try {
    const {
      type,
      content,
      options,
      correctAnswers,
      testCases,
      explanation,
      tags,
      images,
      platformConfig
    } = req.body;

    // UPDATED: Enhanced validation for explicit type separation
    if (!['mcq', 'msq', 'descriptive', 'image', 'coding'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question type. Must be one of: mcq, msq, descriptive, image, coding'
      });
    }

    // UPDATED: Type-specific validation
    if (type === 'coding') {
      // Coding questions require test cases
      if (!testCases || testCases.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Coding questions must have at least one test case'
        });
      }

      // Validate platform config for coding questions
      if (platformConfig) {
        const { gradingType, allowedLanguages, timeLimit, memoryLimit } = platformConfig;
        
        if (gradingType && !['all-or-nothing', 'partial', 'weighted'].includes(gradingType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid grading type. Must be: all-or-nothing, partial, or weighted'
          });
        }

        if (allowedLanguages && (!Array.isArray(allowedLanguages) || allowedLanguages.length === 0)) {
          return res.status(400).json({
            success: false,
            message: 'Coding questions must specify at least one allowed language'
          });
        }

        if (timeLimit && (timeLimit < 1 || timeLimit > 30)) {
          return res.status(400).json({
            success: false,
            message: 'Time limit must be between 1 and 30 seconds'
          });
        }

        if (memoryLimit && (memoryLimit < 64 || memoryLimit > 512)) {
          return res.status(400).json({
            success: false,
            message: 'Memory limit must be between 64 and 512 MB'
          });
        }
      }
    }

    // UPDATED: MCQ/MSQ validation
    if ((type === 'mcq' || type === 'msq')) {
      if (!options || options.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'MCQ/MSQ questions must have at least 2 options'
        });
      }

      if (!correctAnswers || correctAnswers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'MCQ/MSQ questions must have correct answers'
        });
      }

      if (type === 'mcq' && correctAnswers.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'MCQ questions can only have one correct answer'
        });
      }
    }

    // REMOVED: Auto-detection of coding questions from descriptive + testCases
    // Now explicit type separation

    const question = await Question.create({
      type,
      content,
      options: (type === 'mcq' || type === 'msq') ? options : undefined,
      correctAnswers: (type === 'mcq' || type === 'msq') ? correctAnswers : undefined,
      testCases: type === 'coding' ? testCases : undefined,
      explanation,
      tags: {
        ...tags,
        creator: req.user.id
      },
      images: images || [],
      platformConfig: type === 'coding' ? platformConfig : undefined
    });

    res.status(201).json({
      success: true,
      data: question
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE: Add helper method for question type checking
exports.getQuestionsByType = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = {};
    
    if (type && ['mcq', 'msq', 'descriptive', 'image', 'coding'].includes(type)) {
      filter.type = type;
    }

    const questions = await Question.find(filter)
      .populate('tags.creator', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE: Add method to get coding question execution config
exports.getQuestionExecutionConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    if (question.type !== 'coding') {
      return res.status(400).json({
        success: false,
        message: 'Question is not a coding question'
      });
    }

    const config = question.getExecutionConfig();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
};


exports.getQuestions = async (req, res, next) => {
  try {
    const questions = await Question.find()
      .populate('tags.creator','name email');
      console.log(questions);
    res.json({ success:true, data:questions });
  } catch (err) {
    next(err);
  }
};

exports.getQuestion = async (req, res, next) => {
  try {
    const q = await Question.findById(req.params.id)
      .populate('tags.creator','name email');
    if (!q) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data:q });
  } catch (err) {
    next(err);
  }
};

// @desc Update a question
// controllers/question.js
// UPDATE: updateQuestion function
exports.updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // UPDATED: Prevent type changes that would break existing data
    if (updates.type && updates.type !== question.type) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change question type after creation. Create a new question instead.'
      });
    }

    // UPDATED: Apply same validation as create
    if (updates.type === 'coding' || question.type === 'coding') {
      if (updates.testCases !== undefined && (!updates.testCases || updates.testCases.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Coding questions must have at least one test case'
        });
      }
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('tags.creator', 'name email');

    res.json({
      success: true,
      data: updatedQuestion
    });
  } catch (error) {
    next(error);
  }
};


// @desc Delete a question
exports.deleteQuestion = async (req, res, next) => {
  try {
    const q = await Question.findByIdAndDelete(req.params.id);
    if (!q) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, message:'Deleted' });
  } catch (err) {
    next(err);
  }
};
 