const mongoose = require('mongoose');
const Question = require('../models/Question');

async function migrateQuestionsToCode() {
  try {
    console.log('Starting migration of coding questions...');
    
    // Find descriptive questions that should be coding questions
    const descriptiveQuestions = await Question.find({
      type: 'descriptive',
      testCases: { $exists: true, $not: { $size: 0 } }
    });
    
    console.log(`Found ${descriptiveQuestions.length} descriptive questions with test cases`);
    
    for (const question of descriptiveQuestions) {
      // Check if content suggests it's a coding question
      const codingKeywords = ['program', 'code', 'function', 'algorithm', 'write a', 'implement', 'solve'];
      const content = question.content.toLowerCase();
      const hasKeywords = codingKeywords.some(keyword => content.includes(keyword));
      
      if (hasKeywords) {
        console.log(`Migrating question: ${question._id} - "${question.content.substring(0, 50)}..."`);
        
        // Update to coding question
        await Question.findByIdAndUpdate(question._id, {
          isCodingQuestion: true,
          autoGraded: true,
          platform: 'judge0',
          'platformConfig.allowedLanguages': ['javascript', 'python', 'cpp', 'java'],
          'platformConfig.timeLimit': 5,
          'platformConfig.memoryLimit': 128,
          'platformConfig.gradingType': 'partial'
        });
        
        console.log(`✅ Migrated question ${question._id}`);
      }
    }
    
    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Uncomment and run this if you want to migrate existing questions:
// migrateQuestionsToCode();