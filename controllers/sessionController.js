// models/Session.js - Track active quiz/test sessions
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  timeRemaining: {
    type: Number, // milliseconds
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  autoSubmitted: {
    type: Boolean,
    default: false
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  // Track if session was paused (for debugging)
  pausedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
sessionSchema.index({ student: 1, assignment: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1, isActive: 1 }); // For cleanup tasks

// Instance method to check if session is expired
sessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Instance method to calculate remaining time
sessionSchema.methods.getRemainingTime = function() {
  if (this.isExpired()) return 0;
  return Math.max(0, this.expiresAt.getTime() - Date.now());
};

// Static method to find active session for student + assignment
sessionSchema.statics.findActiveSession = function(studentId, assignmentId) {
  return this.findOne({
    student: studentId,
    assignment: assignmentId,
    isActive: true
  }).populate('assignment', 'title mode timeLimitMinutes');
};

// Static method to cleanup expired sessions
sessionSchema.statics.cleanupExpiredSessions = async function() {
  const expiredSessions = await this.find({
    expiresAt: { $lt: new Date() },
    isActive: true,
    autoSubmitted: false
  });

  console.log(`Found ${expiredSessions.length} expired sessions to auto-submit`);
  
  // Mark as auto-submitted and inactive
  await this.updateMany(
    { _id: { $in: expiredSessions.map(s => s._id) } },
    { 
      isActive: false, 
      autoSubmitted: true,
      timeRemaining: 0
    }
  );

  return expiredSessions;
};

module.exports = mongoose.model('Session', sessionSchema);