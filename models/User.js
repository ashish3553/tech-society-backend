const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const crypto   = require('crypto')

const userSchema = new mongoose.Schema({
  name:       { type:String, required:true },
  email:      { type:String, required:true, unique:true },
  password:   { type:String, required:true, select:false },
  role:       { type:String, enum:['student','mentor','admin'], default:'student' },
  branch:     { type:String, required:true },
  year:       { type:String, required:true },
  isVerified: { type:Boolean, default:false },
  
  verifyToken:       String,
  verifyTokenExpiry: Date,
  resetPasswordToken:       String,
  resetPasswordExpires:     Date,
},{
  timestamps:true
})

// hash password
userSchema.pre('save', async function(){
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

// compare
userSchema.methods.matchPassword = function(plain){ return bcrypt.compare(plain, this.password) }

// generate email-verify token
userSchema.methods.getVerifyToken = function(){
  const token = crypto.randomBytes(20).toString('hex')
  this.verifyToken = crypto.createHash('sha256').update(token).digest('hex')
  this.verifyTokenExpiry = Date.now()+ 24*60*60*1000
  return token
}

// generate reset token
userSchema.methods.getResetToken = function(){
  const token = crypto.randomBytes(20).toString('hex')
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex')
  this.resetPasswordExpires = Date.now()+ 60*60*1000
  return token
}

module.exports = mongoose.model('User', userSchema)
