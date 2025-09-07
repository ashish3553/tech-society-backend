// models/User.js - Updated with minimal changes for enhanced email tracking
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'mentor', 'admin'], default: 'student' },
  
  // Make branch/year conditionally required
  branch: { 
    type: String, 
    required: function() { return this.isUIETHStudent; },
    validate: {
      validator: function(v) {
        if (!this.isUIETHStudent) return true; // not required for general users
        return v && v.trim().length > 0;
      },
      message: 'Branch is required for UIETH students'
    }
  },
  year: { 
    type: String, 
    required: function() { return this.isUIETHStudent; },
    validate: {
      validator: function(v) {
        if (!this.isUIETHStudent) return true; // not required for general users
        return v && ['1', '2', '3', '4'].includes(v);
      },
      message: 'Year must be 1, 2, 3, or 4 for UIETH students'
    }
  },
  
  isVerified: { type: Boolean, default: false },
  isUIETHStudent: { type: Boolean, default: false }, // Default false for new users
  rollNumber: { 
    type: String, 
    sparse: true,
    validate: {
      validator: function(v) {
        if (!this.isUIETHStudent || !v) return true;
        return /^SG2\d{4}$/.test(v) && parseInt(v.slice(-2)) < 80;
      },
      message: 'Invalid roll number format. Must be SG2xxxx with last two digits < 80'
    }
  },
  isBanned: { type: Boolean, default: false },
  bannedAt: Date,
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  banReason: String,
  
  // Email verification fields
  verifyToken: String,
  verifyTokenExpiry: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastVerificationSent: { type: Date },
  verificationAttempts: { type: Number, default: 0 },
}, {
  timestamps: true
})

// EXISTING - Keep all your existing methods exactly as they are
userSchema.pre('save', async function(){
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

userSchema.methods.matchPassword = function(plain){ 
  return bcrypt.compare(plain, this.password) 
}

userSchema.methods.getVerifyToken = function(){
  const token = crypto.randomBytes(20).toString('hex')
  this.verifyToken = crypto.createHash('sha256').update(token).digest('hex')
  this.verifyTokenExpiry = Date.now()+ 24*60*60*1000
  
  // NEW - Track when verification email is sent
  this.lastVerificationSent = new Date()
  this.verificationAttempts = (this.verificationAttempts || 0) + 1
  
  return token
}

userSchema.methods.getResetToken = function(){
  const token = crypto.randomBytes(20).toString('hex')
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
  this.resetPasswordExpires = Date.now()+ 60*60*1000
  return token
}

module.exports = mongoose.model('User', userSchema)