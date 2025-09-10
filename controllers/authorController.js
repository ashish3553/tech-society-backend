// controllers/authorController.js - Complete Author Management Controller
const Author = require('../models/Author');
const AuthorInvitation = require('../models/AuthorInvitation');
const User = require('../models/User');
const Article = require('../models/Article');
const sendEmail = require('../utils/mailer');
const { sendInvitationEmail } = require('../lib/mail');
const bcrypt   = require('bcryptjs')

// Add JWT import at the top of the file if not already present
const jwt = require('jsonwebtoken');

// Move signToken function outside or add it at the top
function signToken(id) { 
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn:'7d' }) 
}
const crypto = require('crypto');

exports.inviteAuthor = async (req, res) => {
  try {
    const { email, name, message, permissions } = req.body;
    
    // **NEW: Clean up old invitations for this email**
    await AuthorInvitation.deleteMany({ 
      email: email.toLowerCase(),
      isAccepted: true // Only delete completed invitations
    });
    
    // **NEW: Check for pending invitation**
    const existingPendingInvitation = await AuthorInvitation.findOne({
      email: email.toLowerCase(),
      isAccepted: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (existingPendingInvitation) {
      return res.status(400).json({
        success: false,
        message: 'An invitation is already pending for this email address'
      });
    }
    
    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');
    
    // Create invitation record
    const invitation = new AuthorInvitation({ 
      email: email.toLowerCase(), // **NEW: Normalize email**
      name,
      token,
      message,
      permissions,
      invitedBy: req.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    await invitation.save();
    
    // Send email with real invitation link
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationLink = `${FRONTEND_URL}/accept-invitation?token=${token}`;
    
    // **NEW: Add error handling for email**
    try {
      await sendInvitationEmail({
        to: email,
        name: name,
        inviterName: req.user.name || 'Admin',
        invitationLink,
        message,
        permissions
      });
      
      console.log(`✅ Invitation email sent successfully to ${email}`); // **NEW: Add logging**
      
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError);
      
      // Delete the invitation if email fails
      await AuthorInvitation.findByIdAndDelete(invitation._id);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send invitation email. Please try again.'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: invitation
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Resend author invitation
exports.resendInvitation = async (req, res, next) => {
  try {
    const { authorId } = req.params;
    const invitedBy = req.user.id;

    // Find the author
    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Check if invitation is still pending
    if (author.invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot resend invitation. Current status: ${author.invitation.status}`
      });
    }

    // Check if invitation has expired and update if needed
    if (author.invitation.tokenExpires && author.invitation.tokenExpires < new Date()) {
      // Generate new invitation token
      const invitationToken = author.generateInvitationToken();
      await author.save();
    }

    // Get current invitation token
    const invitationToken = author.invitation.token;
    const invitationUrl = `${process.env.CLIENT_URL}/authors/accept-invitation/${invitationToken}`;
    
    // Get inviter details
    const inviterUser = await User.findById(invitedBy).select('name email');

    // Send invitation email
    await sendEmail({
      to: author.profile.email,
      subject: `Reminder: You're invited to become an author at Tech Society`,
      html: generateInvitationEmailHTML({
        authorName: author.profile.name,
        inviterName: inviterUser.name,
        invitationUrl,
        bio: author.profile.bio,
        expertise: author.profile.expertise,
        isResend: true // Flag to indicate this is a resend
      })
    });

    // Update invitation sent count (optional tracking)
    author.invitation.resentCount = (author.invitation.resentCount || 0) + 1;
    author.invitation.lastResentAt = new Date();
    await author.save();

    // Populate response
    await author.populate('invitation.invitedBy', 'name email');

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      data: {
        authorId: author._id,
        email: author.profile.email,
        name: author.profile.name,
        invitationToken,
        invitedBy: author.invitation.invitedBy,
        originalInviteDate: author.invitation.invitedAt,
        resentAt: author.invitation.lastResentAt,
        resentCount: author.invitation.resentCount
      }
    });

  } catch (error) {
    next(error);
  }
};


// Accept invitation with new account (CORRECTED WITH AUTO-LOGIN)
exports.acceptInvitation = async (req, res) => {
  try {
    const { token, userData } = req.body;

    console.log('🔍 ACCEPT INVITATION START');
    console.log('📥 Token received:', token);
    console.log('📥 Token length:', token?.length);
    
    // Check if invitation exists at all first (before filtering)
    const anyInvitation = await AuthorInvitation.findOne({ token });
    console.log('📋 Any invitation found:', !!anyInvitation);
    
    if (anyInvitation) {
      console.log('📋 Current invitation state:');
      console.log('  - Email:', anyInvitation.email);
      console.log('  - isAccepted:', anyInvitation.isAccepted);
      console.log('  - expiresAt:', anyInvitation.expiresAt);
      console.log('  - Current time:', new Date());
      console.log('  - Expired?:', anyInvitation.expiresAt <= new Date());
      
      // Check if Author already exists for this email
      const existingAuthor = await Author.findOne({ 'profile.email': anyInvitation.email });
      console.log('👤 Author already exists for this email:', !!existingAuthor);
      if (existingAuthor) {
        console.log('👤 Existing author ID:', existingAuthor._id);
      }
    }
    
    // Now try the filtered query
    const invitation = await AuthorInvitation.findOne({
      token,
      isAccepted: false,
      expiresAt: { $gt: new Date() }
    });
    
    console.log('✅ Valid invitation found after filtering:', !!invitation);
    
    if (!invitation) {
      console.log('❌ Invitation query failed - possible reasons:');
      if (anyInvitation?.isAccepted) console.log('  - Reason: Already accepted');
      if (anyInvitation?.expiresAt <= new Date()) console.log('  - Reason: Expired');
      if (!anyInvitation) console.log('  - Reason: Token not found in database');
      
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation',
        debug: {
          tokenFound: !!anyInvitation,
          isAccepted: anyInvitation?.isAccepted,
          isExpired: anyInvitation?.expiresAt <= new Date()
        }
      });
    }
    
    console.log('🔍 Checking if user already exists in User database...');
    // Check if user already exists in User database
    const existingUser = await User.findOne({ email: invitation.email });
    console.log('👤 User exists in User database:', !!existingUser);
    
    if (existingUser) {
      console.log('❌ User already exists, should use existing user flow');
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists. Please use "Accept for Existing User" flow.'
      });
    }
    
    console.log('🔐 Hashing password...');
    // Hash password for author-only login
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    console.log('✅ Password hashed successfully');
    
    console.log('👤 Creating Author profile...');
    // Create ONLY Author record (no User record)
    const authorProfile = new Author({
      userId: null, // New authors have no User record
      profile: {
        name: userData.name,
        email: invitation.email,
        verified: true,
        bio: userData.bio || '',
        avatar: userData.avatar || ''
      },
      permissions: invitation.permissions,
      isActive: true,
      
      // Store author's login credentials in Author model
      authCredentials: {
        passwordHash: hashedPassword,
        isVerified: true
      },
      
      invitation: {
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
        status: 'accepted',
        token: invitation.token
      }
    });
    
    await authorProfile.save();
    console.log('✅ Author profile saved successfully:', authorProfile._id);
    
    console.log('🔑 Generating JWT token...');
    // Generate JWT token for auto-login
    const authToken = signToken(authorProfile._id);
    console.log('✅ JWT token generated');
    
    console.log('📝 Marking invitation as accepted...');
    // Mark invitation as accepted
    invitation.isAccepted = true;
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = authorProfile._id;
    await invitation.save();
    console.log('✅ Invitation marked as accepted');
    
    console.log('🎉 SUCCESS: Sending response with auto-login data');
    // Return auto-login response
    res.json({
      success: true,
      message: 'Welcome to Tech Society! Your author account is ready.',
      autoLogin: true, // Flag for frontend to auto-login
      data: { 
        user: {
          id: authorProfile._id,
          name: authorProfile.profile.name,
          email: authorProfile.profile.email,
          role: 'author'
        },
        token: authToken,
        authorData: {
          id: authorProfile._id,
          permissions: authorProfile.permissions,
          verified: authorProfile.profile.verified,
          bio: authorProfile.profile.bio
        },
        accountType: 'author-only'
      }
    });
  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// Get all authors (admin/mentor only)
exports.getAllAuthors = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'all', 
      verified = 'all',
      search = '',
      sortBy = 'joinedAt'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status !== 'all') {
      if (status === 'active') filter.isActive = true;
      else if (status === 'inactive') filter.isActive = false;
      else filter['invitation.status'] = status;
    }

    if (verified !== 'all') {
      filter['profile.verified'] = verified === 'true';
    }

    if (search) {
      filter.$or = [
        { 'profile.name': { $regex: search, $options: 'i' } },
        { 'profile.email': { $regex: search, $options: 'i' } },
        { 'profile.company': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortOptions = {};
    switch (sortBy) {
      case 'name':
        sortOptions['profile.name'] = 1;
        break;
      case 'articles':
        sortOptions['analytics.totalArticles'] = -1;
        break;
      case 'views':
        sortOptions['analytics.totalViews'] = -1;
        break;
      case 'joinedAt':
      default:
        sortOptions['analytics.joinedAt'] = -1;
    }

    const authors = await Author.find(filter)
      .populate('invitation.invitedBy', 'name email')
      .populate('userId', 'name email role lastLogin')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Author.countDocuments(filter);

    res.json({
      success: true,
      data: authors,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalResults: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get single author profile
exports.getAuthorProfile = async (req, res, next) => {
  try {
    const { authorId } = req.params;
    
    const author = await Author.findById(authorId)
      .populate('invitation.invitedBy', 'name email')
      .populate('userId', 'name email role lastLogin')
      .populate('collaborations.article', 'title slug isPublished createdAt')
      .populate('collaborations.addedBy', 'name email');

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Get author's articles
    const articles = await Article.find({
      $or: [
        { createdBy: author.userId },
        { authors: author._id }
      ]
    }).select('title slug isPublished views likes comments createdAt category')
      .populate('category', 'name color')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        ...author.toObject(),
        articles
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getMyAuthorProfile = async (req, res) => {
  try {
    console.log('🔍 Getting author profile for user:', req.user.id);
    console.log('🔍 Account type:', req.accountType);
    
    let author;
    
    if (req.accountType === 'author-only') {
      // For author-only accounts, find by the author's own ID
      author = await Author.findById(req.user.id)
        .populate('collaborations.article', 'title slug isPublished createdAt views likes')
        .populate('collaborations.addedBy', 'name email')
        .populate('invitation.invitedBy', 'name email');
    } else {
      // For combined accounts, find by userId
      author = await Author.findOne({ userId: req.user.id })
        .populate('collaborations.article', 'title slug isPublished createdAt views likes')
        .populate('collaborations.addedBy', 'name email')
        .populate('invitation.invitedBy', 'name email');
    }

    if (!author) {
      console.log('❌ Author profile not found');
      return res.status(404).json({
        success: false,
        message: 'Author profile not found'
      });
    }

    console.log('✅ Author profile found:', author.profile.name);

    // Calculate additional analytics
    const articleQuery = req.accountType === 'author-only' 
      ? { createdBy: req.user.id } // For author-only, articles are created by author ID
      : { 
          $or: [
            { createdBy: req.user.id }, // User created articles
            { authors: author._id }      // Author collaborated articles
          ]
        };

    const totalArticles = await Article.countDocuments(articleQuery);

    // ... rest of your analytics code using the same articleQuery

    res.json({
      success: true,
      data: {
        ...author.toObject(),
        analytics: {
          ...author.analytics,
          totalArticles,
          // ... other analytics
        }
      }
    });
  } catch (error) {
    console.error('❌ Get author profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateMyAuthorProfile = async (req, res) => {
  try {
    const { profile, socialLinks, expertise } = req.body;
    
    // Handle both combined users (userId exists) and author-only users (userId is null)
    let author;
    if (req.accountType === 'author-only') {
      // For author-only accounts, req.user.id is the author's _id
      author = await Author.findById(req.user.id);
    } else {
      // For combined accounts, find by userId
      author = await Author.findOne({ userId: req.user.id });
    }

    // Update profile fields
    if (profile) {
      author.profile = {
        ...author.profile,
        ...profile,
        // Prevent updating certain fields
        email: author.profile.email, // Keep original email
        verified: author.profile.verified, // Keep verification status
        verifiedAt: author.profile.verifiedAt,
        verifiedBy: author.profile.verifiedBy
      };
    }

    if (socialLinks) {
      author.profile.socialLinks = socialLinks;
    }

    if (expertise) {
      author.profile.expertise = expertise;
    }

    await author.save();

   // Only update User record for combined accounts
if (profile?.name && req.accountType !== 'author-only') {
  await User.findByIdAndUpdate(req.user.id, { name: profile.name });
}

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: author
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.getAuthorStats = async (req, res) => {
  try {
    // Total authors count
    const totalAuthors = await Author.countDocuments();

    // Active authors (accepted invitations and active status)
    const activeAuthors = await Author.countDocuments({
      isActive: true,
      'invitation.status': 'accepted'
    });

    // Pending invitations
    const pendingInvites = await Author.countDocuments({
      'invitation.status': 'pending'
    });

    // Inactive authors
    const inactiveAuthors = await Author.countDocuments({
      isActive: false
    });

    // Verified authors
    const verifiedAuthors = await Author.countDocuments({
      'profile.verified': true
    });

    // Total articles by all authors
    const totalArticles = await Article.countDocuments({
      createdBy: { $exists: true }
    });

    // Total views across all author articles
    const viewsStats = await Article.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: { $size: '$likes' } }
        }
      }
    ]);

    // Articles published this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const articlesThisMonth = await Article.countDocuments({
      createdAt: { $gte: startOfMonth },
      isPublished: true
    });

    // Top performing authors
    const topAuthors = await Author.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'articles',
          localField: 'userId',
          foreignField: 'createdBy',
          as: 'articles'
        }
      },
      {
        $addFields: {
          articleCount: { $size: '$articles' },
          totalViews: { $sum: '$articles.views' },
          totalLikes: { $sum: { $map: { input: '$articles', as: 'article', in: { $size: '$$article.likes' } } } }
        }
      },
      {
        $sort: { totalViews: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          'profile.name': 1,
          'profile.email': 1,
          'profile.avatar': 1,
          articleCount: 1,
          totalViews: 1,
          totalLikes: 1
        }
      }
    ]);

    // Recent author activities
    const recentAuthors = await Author.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    })
    .select('profile.name profile.email createdAt invitation.status')
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        totalAuthors,
        activeAuthors,
        pendingInvites,
        inactiveAuthors,
        verifiedAuthors,
        totalArticles,
        totalViews: viewsStats[0]?.totalViews || 0,
        totalLikes: viewsStats[0]?.totalLikes || 0,
        articlesThisMonth,
        topAuthors,
        recentAuthors,
        stats: {
          authorsGrowth: {
            current: totalAuthors,
            active: activeAuthors,
            pending: pendingInvites
          },
          contentMetrics: {
            articles: totalArticles,
            views: viewsStats[0]?.totalViews || 0,
            likes: viewsStats[0]?.totalLikes || 0,
            thisMonth: articlesThisMonth
          }
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



// In your backend, update the searchCollaborators function:
exports.searchCollaborators = async (req, res) => {
  try {
    const { q = '', excludeArticle = null, limit = 20 } = req.query;

    const filter = {
      isActive: true,
      'invitation.status': 'accepted',
      'permissions.canCollaborate': true
    };

    if (q.trim()) {
      filter.$or = [
        { 'profile.name': { $regex: q, $options: 'i' } },
        { 'profile.email': { $regex: q, $options: 'i' } },
        { 'profile.expertise': { $in: [new RegExp(q, 'i')] } }
      ];
    }

    let authors = await Author.find(filter)
      .populate('userId', 'name email') // Populate user data
      .select('profile userId analytics')
      .sort({ 'analytics.totalArticles': -1, 'profile.name': 1 })
      .limit(parseInt(limit))
      .lean();

    // Normalize the response structure
    const formattedAuthors = authors.map(author => ({
      _id: author._id,
      name: author.profile?.name || author.userId?.name || 'Unknown',
      email: author.profile?.email || author.userId?.email || '',
      profile: {
        name: author.profile?.name || author.userId?.name || 'Unknown',
        email: author.profile?.email || author.userId?.email || '',
        bio: author.profile?.bio || '',
        avatar: author.profile?.avatar || '',
        expertise: author.profile?.expertise || []
      },
      analytics: author.analytics
    }));

    res.json({
      success: true,
      data: formattedAuthors
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// Helper function to calculate collaboration score
function calculateCollaborationScore(author, recentArticles) {
  let score = 0;
  
  // Base score from total articles
  score += (author.analytics?.totalArticles || 0) * 10;
  
  // Recent activity bonus
  const recentCount = recentArticles.filter(a => 
    new Date(a.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  score += recentCount * 20;
  
  // Verification bonus
  if (author.profile?.verified) score += 50;
  
  // Expertise bonus
  score += (author.profile?.expertise?.length || 0) * 5;
  
  return score;
}


exports.updateAuthorStatus = async (req, res) => {
  try {
    const { authorId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const author = await Author.findById(authorId).populate('userId', 'name email');

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Prevent self-deactivation
    if (author.userId?._id.toString() === req.user.id && !isActive) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own author account'
      });
    }

    const previousStatus = author.isActive;
    author.isActive = isActive;
    
    if (!isActive) {
      author.deactivatedAt = new Date();
      author.deactivatedBy = req.user.id;
    } else {
      author.reactivatedAt = new Date();
      author.reactivatedBy = req.user.id;
    }

    await author.save();

    // Update user role if being deactivated
    if (!isActive && author.userId) {
      await User.findByIdAndUpdate(author.userId._id, {
        role: 'student' // Or whatever default role you want
      });
    }

    res.json({
      success: true,
      message: `Author ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        authorId: author._id,
        name: author.profile.name,
        email: author.profile.email,
        isActive,
        previousStatus,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.verifyAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;

    const author = await Author.findById(authorId).populate('userId', 'name email');

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    if (author.profile.verified) {
      return res.status(400).json({
        success: false,
        message: 'Author is already verified'
      });
    }

    author.profile.verified = true;
    author.profile.verifiedAt = new Date();
    author.profile.verifiedBy = req.user.id;
    
    await author.save();

    res.json({
      success: true,
      message: 'Author verified successfully',
      data: {
        authorId: author._id,
        name: author.profile.name,
        email: author.profile.email,
        verified: true,
        verifiedAt: author.profile.verifiedAt,
        verifiedBy: req.user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteAuthor = async (req, res) => {
  try {
    const { authorId } = req.params;

    const author = await Author.findById(authorId).populate('userId', 'name email');

    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Prevent self-deletion
    if (author.userId?._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own author account'
      });
    }

    // Check for existing articles
    const articleCount = await Article.countDocuments({
      $or: [
        { createdBy: author.userId?._id },
        { 'collaborators.userId': author.userId?._id }
      ]
    });

    if (articleCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete author with ${articleCount} existing articles. Please transfer or delete articles first.`,
        data: { articleCount }
      });
    }

    // Store author info for response
    const authorInfo = {
      name: author.profile.name,
      email: author.profile.email,
      userId: author.userId?._id
    };

    await AuthorInvitation.deleteMany({ 
  email: author.profile.email 
});

    // Delete author profile
    await Author.findByIdAndDelete(authorId);

    // Update user role back to default if user exists
    if (author.userId) {
      await User.findByIdAndUpdate(author.userId._id, {
        role: 'student' // Or your default role
      });
    }

    res.json({
      success: true,
      message: 'Author deleted successfully',
      data: {
        deletedAuthor: authorInfo,
        deletedAt: new Date(),
        deletedBy: req.user.name
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




// Update author profile
exports.updateAuthorProfile = async (req, res, next) => {
  try {
    const { authorId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Find author
    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Check permissions - only the author themselves or admin can update
    if (author.userId?.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this author profile'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'profile.name', 'profile.bio', 'profile.avatar', 'profile.jobTitle',
      'profile.company', 'profile.location', 'profile.website', 
      'profile.socialLinks', 'profile.expertise'
    ];

    // Admin can also update permissions
    if (req.user.role === 'admin') {
      allowedUpdates.push(
        'permissions.canWrite', 'permissions.canCollaborate', 
        'permissions.canPublish', 'permissions.canInviteOthers',
        'profile.verified', 'isActive'
      );
    }

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          if (!author[parent]) author[parent] = {};
          author[parent][child] = value;
        } else {
          author[key] = value;
        }
      }
    }

    // Set verification timestamp if being verified
    if (updates['profile.verified'] === true && !author.profile.verified) {
      author.profile.verifiedAt = new Date();
      author.profile.verifiedBy = userId;
    }

    await author.save();

    res.json({
      success: true,
      message: 'Author profile updated successfully',
      data: author
    });

  } catch (error) {
    next(error);
  }
};

// Add author to article collaboration
exports.addArticleCollaborator = async (req, res, next) => {
  try {
    const { articleId, authorId, role = 'editor' } = req.body;
    const addedBy = req.user.id;

    // Find author
    const author = await Author.findById(authorId);
    if (!author || !author.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Author not found or inactive'
      });
    }

    // Check if already collaborating
    const existingCollaboration = author.collaborations.find(
      c => c.article.toString() === articleId
    );

    if (existingCollaboration) {
      return res.status(400).json({
        success: false,
        message: 'Author is already a collaborator on this article'
      });
    }

    // Add collaboration
    author.collaborations.push({
      article: articleId,
      role,
      addedBy
    });

    await author.save();

    // Also add to article's authors array
    await Article.findByIdAndUpdate(articleId, {
      $addToSet: { authors: authorId }
    });

    res.json({
      success: true,
      message: 'Collaborator added successfully',
      data: {
        authorId,
        articleId,
        role,
        addedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

// Remove author from article collaboration
exports.removeArticleCollaborator = async (req, res, next) => {
  try {
    const { articleId, authorId } = req.params;

    // Remove from author's collaborations
    await Author.findByIdAndUpdate(authorId, {
      $pull: { collaborations: { article: articleId } }
    });

    // Remove from article's authors array
    await Article.findByIdAndUpdate(articleId, {
      $pull: { authors: authorId }
    });

    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });

  } catch (error) {
    next(error);
  }
};

// Get author analytics
exports.getAuthorAnalytics = async (req, res, next) => {
  try {
    const { authorId } = req.params;
    const { timeframe = '30d' } = req.query;

    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get articles in timeframe
    const articles = await Article.find({
      $or: [
        { createdBy: author.userId },
        { authors: author._id }
      ],
      createdAt: { $gte: startDate }
    });

    // Calculate analytics
    const analytics = {
      timeframe,
      overview: {
        totalArticles: articles.length,
        publishedArticles: articles.filter(a => a.isPublished).length,
        totalViews: articles.reduce((sum, a) => sum + (a.views || 0), 0),
        totalLikes: articles.reduce((sum, a) => sum + (a.likes?.length || 0), 0),
        totalComments: articles.reduce((sum, a) => sum + (a.comments?.length || 0), 0)
      },
      topArticles: articles
        .filter(a => a.isPublished)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5)
        .map(a => ({
          id: a._id,
          title: a.title,
          views: a.views || 0,
          likes: a.likes?.length || 0,
          publishedAt: a.publishedAt
        })),
      categoryDistribution: calculateCategoryDistribution(articles),
      monthlyStats: calculateMonthlyStats(articles, startDate)
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    next(error);
  }
};

// Deactivate author
exports.deactivateAuthor = async (req, res, next) => {
  try {
    const { authorId } = req.params;
    const { reason } = req.body;
    const deactivatedBy = req.user.id;

    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    author.isActive = false;
    author.deactivatedAt = new Date();
    author.deactivatedBy = deactivatedBy;
    author.deactivationReason = reason || 'No reason provided';

    await author.save();

    res.json({
      success: true,
      message: 'Author deactivated successfully'
    });

  } catch (error) {
    next(error);
  }
};

// Helper functions
function generateInvitationEmailHTML({ authorName, inviterName, invitationUrl, bio, expertise }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Author Invitation - Tech Society</title>
        <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .header p { margin: 10px 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 40px 30px; }
            .greeting { font-size: 18px; margin-bottom: 20px; color: #2d3748; }
            .invitation-text { font-size: 16px; line-height: 1.7; margin-bottom: 30px; color: #4a5568; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; transition: transform 0.2s; }
            .cta-button:hover { transform: translateY(-2px); }
            .features { background: #f7fafc; border-radius: 8px; padding: 25px; margin: 30px 0; }
            .features h3 { color: #2d3748; margin: 0 0 15px; font-size: 18px; }
            .feature-list { list-style: none; padding: 0; margin: 0; }
            .feature-list li { padding: 8px 0; color: #4a5568; }
            .feature-list li:before { content: "✓"; color: #48bb78; font-weight: bold; margin-right: 10px; }
            .footer { background: #edf2f7; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
            .social-links { margin: 20px 0; }
            .social-links a { color: #667eea; text-decoration: none; margin: 0 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Tech Society</h1>
                <p>Join our community of technical writers and educators</p>
            </div>
            
            <div class="content">
                <div class="greeting">Hello ${authorName}! 👋</div>
                
                <div class="invitation-text">
                    You've been personally invited by <strong>${inviterName}</strong> to become an author at Tech Society, our interactive learning platform where technical content comes alive through engaging conversations and rich media.
                    
                    <br><br>
                    
                    We believe your expertise would be a valuable addition to our community of educators and technical writers who are passionate about making complex topics accessible and engaging.
                </div>

                ${expertise && expertise.length > 0 ? `
                <div class="features">
                    <h3>🎯 Your Expertise Areas</h3>
                    <p style="color: #4a5568; margin: 0;">${expertise.join(', ')}</p>
                </div>
                ` : ''}

                <div class="features">
                    <h3>🌟 What You'll Get as an Author</h3>
                    <ul class="feature-list">
                        <li>Create interactive, chat-style articles with multiple characters</li>
                        <li>Rich content editor with code blocks, images, and videos</li>
                        <li>Collaborate with other authors on complex topics</li>
                        <li>Analytics dashboard to track your article performance</li>
                        <li>Author verification badge for credibility</li>
                        <li>Direct engagement with students through comments</li>
                    </ul>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="${invitationUrl}" class="cta-button">
                        Accept Invitation & Join Tech Society
                    </a>
                </div>

                <div style="background: #fff8dc; border-left: 4px solid #f6e05e; padding: 15px; margin: 30px 0; font-size: 14px; color: #744210;">
                    <strong>⏰ Important:</strong> This invitation expires in 7 days. Click the button above to accept and set up your author account.
                </div>

                <div style="font-size: 14px; color: #718096; margin-top: 30px;">
                    Questions? Reply to this email and we'll be happy to help you get started.
                </div>
            </div>
            
            <div class="footer">
                <div class="social-links">
                    <a href="#">Website</a> |
                    <a href="#">Help Center</a> |
                    <a href="#">Community</a>
                </div>
                <p>© ${new Date().getFullYear()} Tech Society. Making technical education interactive and engaging.</p>
                <p style="font-size: 12px; margin-top: 15px;">
                    If you didn't expect this invitation, you can safely ignore this email.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function calculateCategoryDistribution(articles) {
  const distribution = {};
  articles.forEach(article => {
    if (article.category) {
      const categoryName = article.category.name || 'Uncategorized';
      distribution[categoryName] = (distribution[categoryName] || 0) + 1;
    }
  });
  return distribution;
}

function calculateMonthlyStats(articles, startDate) {
  const stats = {};
  articles.forEach(article => {
    const month = article.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!stats[month]) {
      stats[month] = { articles: 0, views: 0, likes: 0 };
    }
    stats[month].articles++;
    stats[month].views += article.views || 0;
    stats[month].likes += article.likes?.length || 0;
  });
  return stats;
}

// / Verify invitation token (NEW ENDPOINT)
// In your authorController.js - Add or replace verifyInvitation:
exports.verifyInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    
    const invitation = await AuthorInvitation.findOne({
      token,
      isAccepted: false,
      expiresAt: { $gt: new Date() }
    }).populate('invitedBy', 'name email');
    
    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation token'
      });
    }
    
    // Check if user already exists in User collection
    const existingUser = await User.findOne({ email: invitation.email });
    
    // Structure response to match frontend expectations
    res.json({
  success: true,
  data: {
    invitation: {
      ...invitation.toObject(),
      isExistingUser: !!existingUser
    }
  }
});
    
  } catch (error) {
    console.error('Verify invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invitation'
    });
  }
};

// Get author public profile (for article attribution)
exports.getAuthorPublicProfile = async (req, res) => {
  try {
    const { authorId } = req.params;
    
    const Author = require('../models/Author');
    
    const author = await Author.findById(authorId)
      .select('profile.name profile.avatar profile.bio profile.verified profile.expertise profile.jobTitle profile.company analytics.totalArticles analytics.totalViews')
      .lean();
    
    if (!author) {
      return res.status(404).json({
        success: false,
        message: 'Author not found'
      });
    }

    // Only return public information
    const publicProfile = {
      _id: author._id,
      name: author.profile.name,
      avatar: author.profile.avatar,
      bio: author.profile.bio,
      jobTitle: author.profile.jobTitle,
      company: author.profile.company,
      expertise: author.profile.expertise,
      verified: author.profile.verified,
      stats: {
        totalArticles: author.analytics?.totalArticles || 0,
        totalViews: author.analytics?.totalViews || 0
      }
    };

    res.json({
      success: true,
      data: publicProfile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


// Accept invitation for existing user
// Add this method to authorController.js
// Accept invitation for existing user
exports.acceptInvitationExisting = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id; // Must be authenticated
    
    const invitation = await AuthorInvitation.findOne({
      token,
      isAccepted: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!invitation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }
    
    // Verify email matches
    if (invitation.email !== req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'This invitation is for a different email address'
      });
    }
    
    // Create Author record linked to existing User
    const authorProfile = new Author({
      userId: userId, // ✅ Link to existing User
      profile: {
        name: req.user.name,
        email: req.user.email,
        verified: true
      },
      permissions: invitation.permissions,
      isActive: true,
      // No authCredentials needed - uses User authentication
      
      invitation: {
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
        status: 'accepted'
      }
    });
    
    await authorProfile.save();
    
    // Mark invitation as accepted
    invitation.isAccepted = true;
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = userId;
    await invitation.save();
    
    res.json({
      success: true,
      message: 'Author privileges added to your account',
      data: { 
        authorProfile,
        accountType: 'combined' // ✅ User + Author combination
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
module.exports = {
  inviteAuthor: exports.inviteAuthor,
  acceptInvitation: exports.acceptInvitation,
  getAllAuthors: exports.getAllAuthors,
  getAuthorProfile: exports.getAuthorProfile,
  updateAuthorProfile: exports.updateAuthorProfile,
  addArticleCollaborator: exports.addArticleCollaborator,
  removeArticleCollaborator: exports.removeArticleCollaborator,
  getAuthorAnalytics: exports.getAuthorAnalytics,
  deactivateAuthor: exports.deactivateAuthor,
  verifyInvitation: exports.verifyInvitation,
  getAuthorPublicProfile: exports.getAuthorPublicProfile,
  getMyAuthorProfile: exports.getMyAuthorProfile,
  updateMyAuthorProfile: exports.updateMyAuthorProfile,
  getAuthorStats: exports.getAuthorStats,
  searchCollaborators: exports.searchCollaborators,
  updateAuthorStatus: exports.updateAuthorStatus,
  verifyAuthor: exports.verifyAuthor,
  deleteAuthor: exports.deleteAuthor,
  resendInvitation: exports.resendInvitation,
  acceptInvitationExisting: exports.acceptInvitationExisting
};