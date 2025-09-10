// models/Article.js - Updated with Author Support
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: String,
  characterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Character' },
  side: { type: String, enum: ['left', 'right'] },
  message: String,
  
  // Enhanced message content
  images: [{
    url: String,
    caption: String,
    _id: false
  }],
  
  timestamp: { type: Date, default: Date.now },
  position: Number,
  
  // Author attribution for messages
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' }
});

const ContentBlockSchema = new mongoose.Schema({
  id: String,
  type: {
    type: String,
    enum: ['image', 'code', 'video', 'text', 'quiz', 'carousel'], // Added carousel
    required: true
  },
  content: {
    // For text blocks
    html: String,
    
    // For images
    imageUrl: String,
    imageCaption: String,
    allowZoom: { type: Boolean, default: true },
    
    // For code blocks
    code: String,
    language: String,
    title: String,
    
    // For videos - ENHANCED
    videoUrl: String, // Cloudinary URL or YouTube embed
    driveLink: String, // Google Drive link alternative
    youtubeUrl: String, // Original YouTube URL
    videoTitle: String,
    thumbnail: String,
    duration: Number, // Video duration in seconds
    
    // For carousel blocks - NEW
    slides: [{
      id: String,
      title: String,
      subtitle: String,
      description: String,
      imageUrl: String,
      backgroundColor: { type: String, default: '#6366f1' },
      _id: false
    }],
    autoPlay: { type: Boolean, default: true },
    autoPlayInterval: { type: Number, default: 5000 },
    showArrows: { type: Boolean, default: true },
    showIndicators: { type: Boolean, default: true },
    
    // For embedded quiz
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArticleQuiz' }
  },
  position: Number,
  
  // Author attribution for content blocks
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' }
});


const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  description: String,
  
  // Article content structure
  characters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Character' }],
  messages: [MessageSchema],
  contentBlocks: [ContentBlockSchema],
  
  // Article flow (ordered sequence of messages and content blocks)
  articleFlow: [{
    type: { type: String, enum: ['message', 'content'] },
    id: String, // References message.id or contentBlock.id
    position: Number
  }],
  
  // ENHANCED: Multiple Authors Support
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Author' }], // Collaborating authors
  
  // Author permissions for this article
  authorPermissions: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
    role: { 
      type: String, 
      enum: ['owner', 'editor', 'reviewer'], 
      default: 'editor' 
    },
    canEdit: { type: Boolean, default: true },
    canPublish: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Categorization
category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ArticleCategory', // Make sure this matches your model name
    required: true 
  },
  tags: [String],
  
  // ENHANCED: Visibility Controls
  visibility: {
    type: { 
      type: String, 
      enum: ['all', 'mentors', 'branch', 'year', 'custom'], 
      default: 'all' 
    },
    branches: [String], // ['Computer Science', 'Information Technology', etc.]
    years: [String], // ['1st Year', '2nd Year', etc.]
    specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  
  // Publishing
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Engagement
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ArticleComment' }],
  
  // Article metadata
  thumbnail: String, // Article header image
  shareImage: String, // Social media share image
  readingTime: Number, // Estimated reading time in minutes
  

   sortOrder: { 
    type: Number, 
    default: 0 
  },
  
  views: { 
    type: Number, 
    default: 0 
  },
  // SEO
  slug: String,
  metaDescription: String,
  
  // Version control (for future use)
  version: { type: Number, default: 1 },
  previousVersions: [{
    version: Number,
    data: mongoose.Schema.Types.Mixed,
    savedAt: Date,
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
ArticleSchema.index({ createdBy: 1 });
ArticleSchema.index({ authors: 1 });
ArticleSchema.index({ isPublished: 1 });
// ArticleSchema.index({ category: 1 });
ArticleSchema.index({ slug: 1 }, { unique: true });
ArticleSchema.index({ 'visibility.type': 1 });
ArticleSchema.index({ 'visibility.branches': 1 });
ArticleSchema.index({ 'visibility.years': 1 });
ArticleSchema.index({ publishedAt: -1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ category: 1, sortOrder: 1 });

// // Generate unique slug before saving
// ArticleSchema.pre('save', function(next) {
//   if (this.isModified('title')) {
//     this.slug = this.title
//       .toLowerCase()
//       .replace(/[^a-z0-9\s]/g, '')
//       .replace(/\s+/g, '-')
//       .substring(0, 60);
    
//     // Add timestamp to ensure uniqueness
//     this.slug += '-' + Date.now().toString(36);
//   }
//   next();
// });

// Calculate reading time before saving
ArticleSchema.pre('save', function(next) {
  if (this.isModified('messages') || this.isModified('contentBlocks')) {
    let wordCount = 0;
    
    // Count words in messages
    this.messages.forEach(msg => {
      if (msg.message) {
        wordCount += msg.message.split(' ').length;
      }
    });
    
    // Count words in content blocks
    this.contentBlocks.forEach(block => {
      if (block.type === 'text' && block.content.html) {
        const textContent = block.content.html.replace(/<[^>]*>/g, '');
        wordCount += textContent.split(' ').length;
      }
    });
    
    // Average reading speed: 200 words per minute
    this.readingTime = Math.ceil(wordCount / 200) || 1;
  }
  next();
});

// Update author analytics after save
ArticleSchema.post('save', async function(doc) {
  try {
    const Author = mongoose.model('Author');
    
    // Update analytics for main author
    if (doc.createdBy) {
      const mainAuthor = await Author.findOne({ userId: doc.createdBy });
      if (mainAuthor) {
        await mainAuthor.updateAnalytics();
      }
    }
    
    // Update analytics for collaborating authors
    if (doc.authors && doc.authors.length > 0) {
      for (const authorId of doc.authors) {
        const author = await Author.findById(authorId);
        if (author) {
          await author.updateAnalytics();
        }
      }
    }
  } catch (error) {
    console.error('Error updating author analytics:', error);
  }
});

// Methods for author management
ArticleSchema.methods.addCollaborator = function(authorId, role = 'editor', addedBy) {
  // Check if author is already a collaborator
  const existingCollaborator = this.authorPermissions.find(
    ap => ap.author.toString() === authorId.toString()
  );
  
  if (existingCollaborator) {
    return false; // Already a collaborator
  }
  
  // Add to authors array
  if (!this.authors.includes(authorId)) {
    this.authors.push(authorId);
  }
  
  // Add permissions
  this.authorPermissions.push({
    author: authorId,
    role,
    canEdit: true,
    canPublish: role === 'owner',
    addedBy
  });
  
  return true;
};

ArticleSchema.methods.removeCollaborator = function(authorId) {
  // Remove from authors array
  this.authors = this.authors.filter(id => id.toString() !== authorId.toString());
  
  // Remove permissions
  this.authorPermissions = this.authorPermissions.filter(
    ap => ap.author.toString() !== authorId.toString()
  );
  
  return true;
};

ArticleSchema.methods.canUserEdit = function(userId) {
  // Article creator can always edit
  if (this.createdBy.toString() === userId) {
    return true;
  }
  
  // Check if user is a collaborating author with edit permissions
  const Author = mongoose.model('Author');
  return Author.findOne({ 
    userId, 
    _id: { $in: this.authors }
  }).then(author => {
    if (!author) return false;
    
    const permissions = this.authorPermissions.find(
      ap => ap.author.toString() === author._id.toString()
    );
    
    return permissions ? permissions.canEdit : false;
  });
};

ArticleSchema.methods.canUserPublish = function(userId) {
  // Article creator can publish if they have publish permissions
  if (this.createdBy.toString() === userId) {
    const Author = mongoose.model('Author');
    return Author.findOne({ userId }).then(author => {
      return author ? author.permissions.canPublish : false;
    });
  }
  
  // Check collaborator permissions
  const Author = mongoose.model('Author');
  return Author.findOne({ 
    userId, 
    _id: { $in: this.authors }
  }).then(author => {
    if (!author) return false;
    
    const permissions = this.authorPermissions.find(
      ap => ap.author.toString() === author._id.toString()
    );
    
    return permissions ? permissions.canPublish : false;
  });
};

// Check if article is visible to specific user
ArticleSchema.methods.isVisibleToUser = function(user) {
  if (!this.isPublished) return false;
  
  switch (this.visibility.type) {
    case 'all':
      return true;
    
    case 'mentors':
      return user && ['mentor', 'admin'].includes(user.role);
    
    case 'branch':
      return user && this.visibility.branches.includes(user.branch);
    
    case 'year':
      return user && this.visibility.years.includes(user.year);
    
    case 'custom':
      return user && this.visibility.specificUsers.includes(user._id);
    
    default:
      return false;
  }
};

module.exports = mongoose.model('Article', ArticleSchema);