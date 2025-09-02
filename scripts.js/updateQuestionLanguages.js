// scripts/updateQuestionType.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load .env variables

// Import your Question model
const Question = require('../models/Question');

async function updateQuestionType() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update all descriptive questions with testCases → coding
    const result = await Question.updateMany(
      { type: 'descriptive', testCases: { $exists: true, $ne: [] } },
      { $set: { type: 'coding' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} questions from descriptive ➝ coding`);

    // Show a sample
    const sample = await Question.find({ type: 'coding' })
      .limit(3)
      .select('content type testCases');

    console.log('\n📋 Sample updated questions:');
    sample.forEach(q => {
      console.log(`- ${q.content.substring(0, 50)}...`);
      console.log(`  Type: ${q.type}`);
      console.log(`  TestCases: ${q.testCases?.length || 0}\n`);
    });

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

updateQuestionType();
 