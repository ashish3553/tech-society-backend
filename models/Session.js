// models/Session.js - Track active quiz/test sessions
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },

    // Keep persisted but NOT required; compute at read time via getRemainingTime()
    timeRemaining: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
    autoSubmitted: { type: Boolean, default: false },
    lastHeartbeat: { type: Date, default: Date.now },
    pausedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
sessionSchema.index({ student: 1, assignment: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1, isActive: 1 });

// Instance methods
sessionSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

sessionSchema.methods.getRemainingTime = function () {
  if (this.isExpired()) return 0;
  return Math.max(0, this.expiresAt.getTime() - Date.now());
};

// Statics
sessionSchema.statics.findActiveSession = function (studentId, assignmentId) {
  return this.findOne({
    student: studentId,
    assignment: assignmentId,
    isActive: true,
  }).populate('assignment', 'title mode timeLimitMinutes');
};

sessionSchema.statics.cleanupExpiredSessions = async function () {
  const expiredSessions = await this.find({
    expiresAt: { $lt: new Date() },
    isActive: true,
    autoSubmitted: false,
  });

  if (expiredSessions.length > 0) {
    await this.updateMany(
      { _id: { $in: expiredSessions.map((s) => s._id) } },
      { isActive: false, autoSubmitted: true, timeRemaining: 0 }
    );
  }

  return expiredSessions;
};

// IMPORTANT: guard to prevent OverwriteModelError
module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
