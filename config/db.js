const mongoose = require('mongoose');
const { seedCategories } = require('../utils/seedCategories');


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI) // Remove deprecated options
    console.log('✅ MongoDB connected')
seedCategories()  // Seed categories on startup
   } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    process.exit(1)
  }
}

module.exports = connectDB;


