// 1. Create AuthorInvitation Model (models/AuthorInvitation.js)
const mongoose = require('mongoose');

const AuthorInvitationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  message: { type: String },
  
  permissions: {
    canWrite: { type: Boolean, default: true },
    canCollaborate: { type: Boolean, default: true },
    canPublish: { type: Boolean, default: false },
    canManage: { type: Boolean, default: false }
  },
  
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  isAccepted: { type: Boolean, default: false },
  acceptedAt: { type: Date },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  expiresAt: { type: Date, required: true },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuthorInvitation', AuthorInvitationSchema);