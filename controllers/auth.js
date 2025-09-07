// controllers/auth.js - Updated with UIETH student support and enhanced email system
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Author = require('../models/Author');
const { 
  sendMail, 
  sendVerificationEmail, 
  sendResetPasswordEmail,
  resendVerificationEmail 
} = require('../lib/mail');

function signToken(id) { 
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' }); 
}

// @desc Register new user & send verification email
exports.register = async (req, res, next) => {
  try {
    console.log("Registration attempt:", req.body);
    const { 
      name, 
      email, 
      password, 
      isUIETHStudent = false, 
      rollNumber, 
      branch, 
      year 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }

    // Validate UIETH student specific fields
    if (isUIETHStudent) {
      if (!branch || !year) {
        return res.status(400).json({
          success: false,
          message: 'Branch and year are required for UIETH students'
        });
      }
      
      // Validate roll number format if provided
      if (rollNumber && (!/^SG2\d{4}$/.test(rollNumber) || parseInt(rollNumber.slice(-2)) >= 80)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid roll number format. Must be SG2xxxx with last two digits < 80'
        });
      }
    }

    // Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }

    // Check for existing author (fix the field path)
    const existingAuthor = await Author.findOne({ "profile.email": email });
    if (existingAuthor) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use as Author' 
      });
    }

    // Check roll number uniqueness if provided
    if (rollNumber) {
      const existingRollNumber = await User.findOne({ rollNumber });
      if (existingRollNumber) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists'
        });
      }
    }

    console.log("Creating user with data:", { 
      name, 
      email, 
      isUIETHStudent, 
      branch: isUIETHStudent ? branch : undefined, 
      year: isUIETHStudent ? year : undefined,
      rollNumber 
    });

    // Create user with conditional fields
    const userData = {
      name,
      email,
      password,
      isUIETHStudent,
      ...(rollNumber && { rollNumber }),
      ...(isUIETHStudent && { branch, year })
    };

    const user = await User.create(userData);

    // Generate email verification token
    const token = user.getVerifyToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    try {
      await sendVerificationEmail({
        to: email,
        name,
        token,
        userId: user.id
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful—please check your email to verify.',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        isUIETHStudent: user.isUIETHStudent,
        verificationSent: true
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    next(err);
  }
};

// Resend verification email
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. You can login directly.'
      });
    }

    // Check rate limiting (5 minutes between attempts)
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (user.lastVerificationSent && user.lastVerificationSent > fiveMinutesAgo) {
      const waitTime = Math.ceil((user.lastVerificationSent.getTime() + 5 * 60 * 1000 - now.getTime()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitTime} more minutes before requesting another verification email.`,
        waitTime
      });
    }

    // Check daily limit (max 5 attempts per day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const attempts = user.verificationAttempts || 0;
    if (attempts >= 5 && user.lastVerificationSent > todayStart) {
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts reached for today. Please try again tomorrow or contact support.'
      });
    }

    // Generate new verification token
    const token = user.getVerifyToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    await resendVerificationEmail({
      to: email,
      name: user.name,
      token,
      attemptNumber: user.verificationAttempts + 1,
      lastSentAt: user.lastVerificationSent,
      userId: user.id
    });

    const attemptsRemaining = Math.max(0, 5 - (user.verificationAttempts || 0));

    res.json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.',
      data: {
        emailSent: true,
        attemptsRemaining,
        canResendAfter: new Date(now.getTime() + 5 * 60 * 1000)
      }
    });

  } catch (error) {
    if (error.message.includes('wait')) {
      return res.status(429).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    console.log("hasher is",hashed)
    const user = await User.findOne({
      verifyToken: hashed,
      verifyTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }
    
    // Mark as verified and clear tokens
    user.isVerified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpiry = undefined;
    
    // Reset verification tracking
    user.verificationAttempts = 0;
    user.lastVerificationSent = undefined;
    
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Email verified successfully! You can now login.',
      data: {
        verified: true,
        verifiedAt: new Date()
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    console.log('🔐 Login attempt for:', req.body.email);
    const { email, password } = req.body;
    
    // Check User model first
    console.log('👤 Checking User model...');
    let user = await User.findOne({ email }).select('+password');
    let userType = 'user';
    let authorData = null;
    
    if (user) {
      console.log('✅ User found in User model:', user.name);
      // Check if existing user also has author profile
      console.log('🔍 Checking for Author profile for existing user...');
      authorData = await Author.findOne({ userId: user._id });
      if (authorData) {
        console.log('✅ Author profile found for user:', authorData.profile.name);
      } else {
        console.log('❌ No Author profile found for user');
      }
    } else {
      console.log('❌ User not found in User model, checking Author model...');
      
      // If not found in User, check Author model
      const author = await Author.findOne({ 
        'profile.email': email,
        'authCredentials.passwordHash': { $exists: true }
      });
      
      if (author) {
        console.log('✅ Author found in Author model:', author.profile.name);
        console.log('🔐 Checking author password...');
        
        const passwordMatch = await author.matchPassword(password);
        console.log('🔐 Password match result:', passwordMatch);
        
        if (passwordMatch) {
          console.log('✅ Author password verified, creating user object');
          // Create user-like object for author-only login
          user = {
            _id: author._id,
            name: author.profile.name,
            email: author.profile.email,
            role: 'author',
            isVerified: author.authCredentials.isVerified,
            isUIETHStudent: false // Authors are not UIETH students by default
          };
          userType = 'author';
          authorData = author;
          console.log('✅ Author user object created:', user.name);
        } else {
          console.log('❌ Author password verification failed');
        }
      } else {
        console.log('❌ Author not found in Author model');
      }
    }
    
    // Validate credentials
    if (!user) {
      console.log('❌ LOGIN FAILED: No user found in either model');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    if (userType === 'user' && !(await user.matchPassword(password))) {
      console.log('❌ LOGIN FAILED: User password incorrect');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    if (!user.isVerified) {
      console.log('❌ LOGIN FAILED: Email not verified');
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email first.',
        needsVerification: true,
        email: user.email
      });
    }

    // Check if user is banned (for regular users)
    if (userType === 'user' && user.isBanned) {
      console.log('❌ LOGIN FAILED: User is banned');
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended.',
        isBanned: true,
        banReason: user.banReason
      });
    }

    console.log('✅ Generating JWT token...');
    const token = signToken(user._id);
    
    // Build response data
    const responseData = {
      user: { 
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isUIETHStudent: user.isUIETHStudent || false,
        ...(userType === 'user' && user.isUIETHStudent && { 
          branch: user.branch, 
          year: user.year,
          rollNumber: user.rollNumber 
        })
      }, 
      token,
      ...(authorData && { 
        authorData: {
          id: authorData._id,
          permissions: authorData.permissions,
          verified: authorData.profile.verified
        }
      }),
      accountType: authorData ? (userType === 'author' ? 'author-only' : 'combined') : 'user-only'
    };
    
    console.log('✅ LOGIN SUCCESS:', {
      userType,
      hasAuthorData: !!authorData,
      accountType: responseData.accountType,
      isUIETHStudent: user.isUIETHStudent
    });
    
    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err.message);
    console.error('Stack trace:', err.stack);
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No user found with that email address' 
      });
    }

    const token = user.getResetToken();
    await user.save({ validateBeforeSave: false });

    // Send enhanced password reset email
    try {
      await sendResetPasswordEmail({
        to: user.email,
        name: user.name,
        token
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      
      // Clear the reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again.'
      });
    }

    res.json({ 
      success: true, 
      message: 'Password reset email sent. Please check your inbox.',
      data: {
        emailSent: true
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired password reset token' 
      });
    }

    // Validate new password
    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Password updated successfully. You can now login with your new password.',
      data: {
        passwordReset: true
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.fetchMe = async (req, res, next) => {
  try {
    // First try to find in User model (for regular users and combined accounts)
    let user = await User.findById(req.user.id).select('-password');
    let authorData = null;
    let accountType = 'user-only';

    if (user) {
      // User found - check if they're also an author
      const author = await Author.findOne({ 
        userId: user._id, 
        isActive: true,
        'invitation.status': 'accepted' 
      });
      
      if (author) {
        authorData = {
          id: author._id,
          permissions: author.permissions,
          verified: author.profile?.verified || false,
          profile: author.profile
        };
        accountType = 'combined';
      }

      return res.json({
        success: true,
        data: {
          user,
          authorData,
          accountType
        }
      });
    }

    // If not found in User model, check Author model (for author-only accounts)
    const author = await Author.findById(req.user.id);
    
    if (!author || !author.isActive || author.invitation.status !== 'accepted') {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Create user-like object for author-only accounts
    const authorOnlyUser = {
      id: author._id,
      _id: author._id,
      name: author.profile.name,
      email: author.profile.email,
      role: 'author',
      isVerified: author.authCredentials?.isVerified || true,
      isUIETHStudent: false // Authors are not UIETH students
    };

    const authorOnlyData = {
      id: author._id,
      permissions: author.permissions,
      verified: author.profile?.verified || false,
      profile: author.profile
    };

    res.json({
      success: true,
      data: {
        user: authorOnlyUser,
        authorData: authorOnlyData,
        accountType: 'author-only'
      }
    });

  } catch (err) {
    console.error('FetchMe error:', err);
    next(err);
  }
};