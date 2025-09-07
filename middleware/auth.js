// middleware/auth.js - Update to handle both User and Author tokens
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Author = require('../models/Author');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log("here arrived after refresh")
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 Auth middleware - decoded token:', decoded);
    
    // Try to find in User model first
    // Try to find in User model first
let user = await User.findById(decoded.id).select('-password');

if (user) {
  console.log('✅ User found in User model:', user.name);
  req.user = user;
  req.accountType = 'user';
  
  // Check if user is also an author
  const author = await Author.findOne({ userId: user._id, isActive: true });
  if (author) {
    req.authorData = author;
    req.accountType = 'combined';
  }
} else {
  // If not found in User, check Author model for author-only accounts
  console.log('🔍 User not found, checking Author model...');
  const author = await Author.findById(decoded.id);
  
  if (author && author.isActive) {
    console.log('✅ Author found in Author model:', author.profile.name);
    // Create user-like object for author-only accounts
    req.user = {
      id: author._id,
      _id: author._id,
      name: author.profile.name,
      email: author.profile.email,
      role: 'author',
      isVerified: author.authCredentials?.isVerified || true
    };
    req.accountType = 'author-only';
    req.authorData = author;
  } else {
    console.log('❌ No user or author found for token');
    return res.status(401).json({ message: 'Invalid token' });
  }
}
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = auth;