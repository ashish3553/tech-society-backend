// controllers/auth.js
const jwt   = require('jsonwebtoken')
const crypto= require('crypto')
const User  = require('../models/User')
const { sendMail } = require('../lib/mail')

function signToken(id){ return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:'7d' }) }

// @desc Register new user & send verification email
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, branch, year } = req.body

    // check for existing
    const existing = await User.findOne({ email })
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'Email already in use' })
    }

    // create user
    const user = await User.create({ name, email, password, branch, year })

    // generate email-verify token
    const token = user.getVerifyToken()
    await user.save({ validateBeforeSave: false })

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${token}`
    const html = `<p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`
    await sendMail({ to: email, subject: 'Verify your TechQB account', html })

    res.status(201).json({
      success: true,
      message: 'Registration successful—please check your email to verify.'
    })
  } catch (err) {
    next(err)
  }
}

exports.verifyEmail = async (req,res,next)=>{
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex')
  const user = await User.findOne({
    verifyToken: hashed,
    verifyTokenExpiry: { $gt: Date.now() }
  })
  if (!user) return res.status(400).json({ success:false, message:'Invalid or expired token' })
  user.isVerified=true
  user.verifyToken=undefined
  user.verifyTokenExpiry=undefined
  await user.save()
  res.json({ success:true, message:'Email verified' })
}

exports.login = async (req,res,next)=>{
  const { email,password } = req.body
  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ success:false, message:'Invalid credentials' })

  if (!user.isVerified)
    return res.status(403).json({ success:false, message:'Please verify email first' })

  const token = signToken(user._id)
  res.json({ success:true, data:{ user:{ id:user._id,name:user.name,email:user.email,role:user.role,branch:user.branch,year:user.year }, token }})
}

exports.forgotPassword = async (req,res,next)=>{
  const user = await User.findOne({ email:req.body.email })
  if (!user) return res.status(404).json({ success:false, message:'No user with that email' })

  const token = user.getResetToken()
  await user.save({ validateBeforeSave:false })

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`
  const html = `<p>Reset your password <a href="${resetUrl}">here</a>.</p>`
  await sendMail({ to:user.email, subject:'Password reset', html })
  res.json({ success:true, message:'Reset email sent' })
}

exports.resetPassword = async (req,res,next)=>{
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex')
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() }
  })
  if (!user) return res.status(400).json({ success:false, message:'Invalid or expired token' })

  user.password = req.body.password
  user.resetPasswordToken = undefined
  user.resetPasswordExpires=undefined
  await user.save()
  res.json({ success:true, message:'Password updated' })
}

exports.fetchMe = async (req,res,next)=>{
  const user = await User.findById(req.user.id) 
  res.json({ success:true, data:user })
}
