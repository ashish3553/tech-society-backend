// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateExistingUsers() {
  try {
    // Check if MONGODB_URI exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Update all existing users to be UIETH students
    const result = await User.updateMany(
      { isUIETHStudent: { $exists: false } },
      { 
        $set: { 
          isUIETHStudent: true,
          isBanned: false 
        } 
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users to UIETH status`);
    
    await mongoose.disconnect();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrateExistingUsers();