// models/Author.js - Complete Author Management System
const mongoose = require('mongoose');

const AuthorSchema = new mongoose.Schema({
  // Link to existing User (if they already have an account)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Author Profile Information
  profile: {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    bio: { type: String, maxlength: 500 },
    avatar: String, // Cloudinary URL
    jobTitle: String,
    company: String,
    location: String,
    website: String,
    
    // Social Links
    socialLinks: [{
      platform: { 
        type: String, 
        enum: ['twitter', 'linkedin', 'github', 'instagram', 'youtube', 'website'] 
      },
      url: String,
      _id: false
    }],
    
    // Expertise Areas
    expertise: [String], // ['JavaScript', 'React', 'Node.js', etc.]
    
    // Verification status
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Author Permissions & Status
  permissions: {
    canWrite: { type: Boolean, default: true },
    canCollaborate: { type: Boolean, default: true },
    canPublish: { type: Boolean, default: false }, // Admins can control publishing
    canInviteOthers: { type: Boolean, default: false }
  },
  
  // Invitation Details
  invitation: {
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: Date,
    token: String, // For invitation acceptance
    tokenExpires: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending'
    }
  },
  
  // Author Activity & Analytics
  analytics: {
    totalArticles: { type: Number, default: 0 },
    publishedArticles: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    lastActiveAt: Date,
    joinedAt: { type: Date, default: Date.now }
  },
   // Add authentication for author-only users
  authCredentials: {
    passwordHash: { type: String }, // Only for userId: null authors
    isVerified: { type: Boolean, default: false },
    lastLogin: Date,
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: Date
  },
  
  // Account Status
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deactivationReason: String,
  
  // Article Collaborations
  collaborations: [{
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    role: { 
      type: String, 
      enum: ['owner', 'editor', 'reviewer'], 
      default: 'editor' 
    },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
AuthorSchema.index({ 'profile.email': 1 });
AuthorSchema.index({ userId: 1 });
AuthorSchema.index({ 'invitation.invitedBy': 1 });
AuthorSchema.index({ 'invitation.status': 1 });
AuthorSchema.index({ isActive: 1 });
AuthorSchema.index({ 'profile.verified': 1 });

// Virtual for author's articles
AuthorSchema.virtual('articles', {
  ref: 'Article',
  localField: '_id',
  foreignField: 'authors',
  justOne: false
});

// Generate invitation token
AuthorSchema.methods.generateInvitationToken = function() {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.invitation.token = token;
  this.invitation.tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return token;
};

// Accept invitation
AuthorSchema.methods.acceptInvitation = function(userId = null) {
  this.invitation.status = 'accepted';
  this.invitation.acceptedAt = new Date();
  this.analytics.joinedAt = new Date();
  this.analytics.lastActiveAt = new Date();
  if (userId) this.userId = userId;
};

AuthorSchema.methods.matchPassword = function(plainPassword) {
  console.log('🔐 Author matchPassword called')
  if (!this.authCredentials?.passwordHash) {
    console.log('❌ No password hash found in authCredentials')
    return false;
  }
  console.log('✅ Password hash exists, comparing...')
  return require('bcryptjs').compare(plainPassword, this.authCredentials.passwordHash);
};


// Check if invitation is valid
AuthorSchema.methods.isInvitationValid = function() {
  return this.invitation.status === 'pending' && 
         this.invitation.tokenExpires > new Date();
};

// Update analytics when article is created/published
AuthorSchema.methods.updateAnalytics = async function() {
  const Article = mongoose.model('Article');
  
  const authorArticles = await Article.find({
    $or: [
      { createdBy: this.userId },
      { authors: this._id }
    ]
  });
  
  this.analytics.totalArticles = authorArticles.length;
  this.analytics.publishedArticles = authorArticles.filter(a => a.isPublished).length;
  this.analytics.totalViews = authorArticles.reduce((sum, a) => sum + (a.views || 0), 0);
  this.analytics.totalLikes = authorArticles.reduce((sum, a) => sum + (a.likes?.length || 0), 0);
  this.analytics.lastActiveAt = new Date();
  
  await this.save();
};

// Static method to find by email or userId
AuthorSchema.statics.findByEmailOrUserId = function(email, userId) {
  const query = { $or: [] };
  if (email) query.$or.push({ 'profile.email': email });
  if (userId) query.$or.push({ userId });
  return this.findOne(query);
};

// Pre-save middleware
AuthorSchema.pre('save', function(next) {
  // Automatically verify if user is admin/mentor
  if (this.userId && !this.profile.verified) {
    // You can add auto-verification logic here
  }
  next();
});

// Post-save middleware to update related documents
AuthorSchema.post('save', async function(doc) {
  // Update article authors if needed
  if (doc.isModified('isActive') && !doc.isActive) {
    const Article = mongoose.model('Article');
    await Article.updateMany(
      { authors: doc._id },
      { $pull: { authors: doc._id } }
    );
  }
});

module.exports = mongoose.model('Author', AuthorSchema);