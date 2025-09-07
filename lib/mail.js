// lib/mail.js - Fixed Email System with resend improvements
const Mailjet = require('node-mailjet')
  .apiConnect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET)

// OPTION 1: Multiple From Addresses (requires separate verification for each)
const FROM_ADDRESSES = [
  { email: "ashish@codeindia.fun", name: "Tech Society Platform" },
  { email: "ashish@codeindia.fun", name: "Tech Society Support" },
  { email: "ashish@codeindia.fun", name: "Tech Society Team" },
  { email: "ashish@codeindia.fun", name: "Tech Society Alerts" },
  { email: "ashish@codeindia.fun", name: "Tech Society Verification" },
  { email: "ashish@codeindia.fun", name: "Tech Society System" }
]

// Function to get rotating from address
function getRotatingFromAddress(userId, attemptNumber = 1) {
  // Use userId and attempt to create consistent but varying selection
  const index = (userId + attemptNumber) % FROM_ADDRESSES.length
  return FROM_ADDRESSES[index]
}

async function sendMail({ to, subject, html, text, userId, attemptNumber = 1 }) { 
  try {
    // Validate inputs
    if (!to || !subject || !html) {
      throw new Error('Missing required email parameters: to, subject, html')
    }

    // OPTION 1: Use rotating from address (comment out if you prefer single address)
    // const fromAddress = getRotatingFromAddress(userId || 1, attemptNumber)
    
    // OPTION 2: Use single from address (uncomment if you prefer this)
    const fromAddress = {
      email: process.env.DEFAULT_FROM_EMAIL || "ashish@codeindia.fun",
      name: "Tech Society Platform"
    }

    const response = await Mailjet
      .post("send", { version: "v3.1" })
      .request({
        Messages: [{
          From: {
            Email: fromAddress.email,
            Name: fromAddress.name
          },
          To: [{ Email: to }],
          Subject: subject,
          HTMLPart: html,
          TextPart: text || _stripHtmlToText(html),
          
          // Remove DeduplicateCampaign to prevent blocking
          CustomCampaign: `tech-society-${attemptNumber || 1}`,
          // DeduplicateCampaign: false, // This helps prevent duplicate blocking
          TrackOpens: "enabled",
          TrackClicks: "enabled"
        }]
      })
    
    console.log(`✅ Email sent successfully to: ${to} from: ${fromAddress.email}`)
    return response
  } catch (error) {
    console.error(`❌ Email sending failed to ${to}:`, error.statusCode, error.message)
    
    // Log detailed error for debugging
    if (error.response && error.response.body) {
      console.error('Mailjet API Error Details:', JSON.stringify(error.response.body, null, 2))
    }
    
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// Helper function to strip HTML and create plain text
function _stripHtmlToText(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gsi, '')
    .replace(/<script[^>]*>.*?<\/script>/gsi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Simple but effective HTML wrapper
function _wrapHtml({ title, preheader, bodyHtml, buttonText, buttonUrl, footerText }) {
  const currentYear = new Date().getFullYear()
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          margin: 0; 
          padding: 0; 
          background-color: #f8fafc; 
          font-family: 'Segoe UI', Arial, sans-serif; 
          font-size: 16px;
          line-height: 1.6;
          color: #374151;
        }
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
          border: 1px solid #e5e7eb;
        }
        .email-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 30px 20px;
          text-align: center;
        }
        .email-header h1 {
          margin: 0;
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
        }
        .email-header p {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
        }
        .email-content {
          padding: 40px 30px;
          background-color: #ffffff;
        }
        .email-content h2 {
          color: #1f2937;
          font-size: 24px;
          margin: 0 0 20px;
          font-weight: 600;
        }
        .email-content p {
          margin: 0 0 20px;
          line-height: 1.7;
          color: #4b5563;
        }
        .email-content ul {
          margin: 15px 0;
          padding-left: 20px;
          line-height: 1.8;
        }
        .email-content li {
          margin-bottom: 8px;
          color: #4b5563;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .primary-button {
          display: inline-block;
          padding: 16px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .primary-button:hover {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
        }
        .info-box {
          background-color: #f0f9ff;
          border-left: 4px solid #0ea5e9;
          padding: 20px;
          margin: 25px 0;
          border-radius: 6px;
        }
        .warning-box {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 20px;
          margin: 25px 0;
          border-radius: 6px;
        }
        .code-block {
          word-break: break-all;
          color: #667eea;
          font-family: 'Courier New', monospace;
          background: #f3f4f6;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          font-size: 14px;
        }
        .email-footer {
          background-color: #f9fafb;
          padding: 30px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
          border-top: 1px solid #e5e7eb;
        }
        .email-footer a {
          color: #667eea;
          text-decoration: none;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          margin: 0 10px;
          color: #667eea;
          text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            margin: 10px;
            border-radius: 8px;
          }
          .email-content {
            padding: 20px;
          }
          .email-header {
            padding: 20px;
          }
          .primary-button {
            display: block;
            padding: 14px 20px;
          }
        }
      </style>
    </head>
    <body>
      <!-- Hidden preheader -->
      <div style="display:none;font-size:1px;color:#f8fafc;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        ${preheader || 'Tech Society Platform - Professional Learning Community'}
      </div>
      
      <div class="email-container">
        <!-- Header -->
        <div class="email-header">
          <h1>Tech Society</h1>
          <p>Professional Learning Platform</p>
        </div>
        
        <!-- Content -->
        <div class="email-content">
          ${bodyHtml}
          
          ${buttonText && buttonUrl ? `
          <div class="button-container">
            <a href="${buttonUrl}" class="primary-button" target="_blank">${buttonText}</a>
          </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="email-footer">
          ${footerText || `
          <p><strong>Tech Society Platform</strong><br>
          Making technical education accessible and engaging</p>
          
          <div class="social-links">
            <a href="mailto:support@codeindia.fun">Help Center</a> •
            <a href="#">Community</a> •
            <a href="#">Privacy Policy</a>
          </div>
          
          <p style="font-size:12px;color:#9ca3af;margin-top:15px;">
            © ${currentYear} Tech Society Platform. All rights reserved.<br>
            This is an automated message. If you didn't request this email, you can safely ignore it.
          </p>
          `}
        </div>
      </div>
    </body>
    </html>
  `
}

// Generate plain text version
function _generateTextVersion(bodyHtml, buttonText, buttonUrl) {
  let text = _stripHtmlToText(bodyHtml)
  
  if (buttonText && buttonUrl) {
    text += `\n\n${buttonText}: ${buttonUrl}`
  }
  
  text += '\n\n' + '='.repeat(50)
  text += '\nTech Society - Professional Learning Platform'
  text += '\nMaking technical education accessible and engaging'
  text += '\n\nIf you didn\'t request this email, you can safely ignore it.'
  text += '\nContact us: support@codeindia.fun'
  text += `\n© ${new Date().getFullYear()} Tech Society Platform. All rights reserved.`
  
  return text
}

// VERIFICATION EMAIL
async function sendVerificationEmail({ to, name, token, userId }) {
  const url = `${process.env.CLIENT_URL}/verify-email/${token}`
  
  const bodyHtml = `
    <h2>Welcome to Tech Society!</h2>
    <p>Hi <strong>${name || 'there'}</strong>,</p>
    <p>Thank you for joining our professional learning platform. To get started, please verify your email address by clicking the button below:</p>
    
    <div class="info-box">
      <p><strong>Why verify your email?</strong></p>
      <ul>
        <li>Secure your account</li>
        <li>Receive important updates</li>
        <li>Reset your password if needed</li>
        <li>Get notifications about your learning progress</li>
      </ul>
    </div>
    
    <div class="warning-box">
      <p><strong>⏰ Important:</strong> This verification link expires in 24 hours for security reasons.</p>
    </div>
    
    <p><strong>Having trouble with the button?</strong> Copy and paste this link into your browser:</p>
    <div class="code-block">${url}</div>
    
    <p>Need help? Contact our support team at <a href="mailto:support@codeindia.fun">support@codeindia.fun</a></p>
  `
  
  const html = _wrapHtml({
    title: "Verify your email - Tech Society",
    preheader: "Welcome to Tech Society! Please confirm your email address to get started.",
    bodyHtml,
    buttonText: "Verify My Email Address",
    buttonUrl: url
  })
  
  const text = _generateTextVersion(bodyHtml, "Verify My Email Address", url)

  await sendMail({
    to,
    subject: "Welcome to Tech Society - Please verify your email",
    html,
    text,
    userId,
    attemptNumber: 1
  })
}

// PASSWORD RESET EMAIL
async function sendResetPasswordEmail({ to, name, token, userId }) {
  const url = `${process.env.CLIENT_URL}/reset-password/${token}`
  
  const bodyHtml = `
    <h2>Password Reset Request</h2>
    <p>Hi <strong>${name || 'there'}</strong>,</p>
    <p>We received a request to reset your password for your Tech Society account. If you made this request, click the button below to create a new password:</p>
    
    <div class="info-box">
      <p><strong>Security Information:</strong></p>
      <ul>
        <li>This password reset link expires in <strong>1 hour</strong></li>
        <li>You can only use this link <strong>once</strong></li>
        <li>If you didn't request this reset, please ignore this email</li>
      </ul>
    </div>
    
    <div class="warning-box">
      <p><strong>🔒 Security Notice:</strong> This link expires quickly for your protection. If it expires, you can request a new password reset.</p>
    </div>
    
    <p><strong>Can't click the button?</strong> Copy and paste this link:</p>
    <div class="code-block">${url}</div>
    
    <p>If you didn't request this, please ignore this email. Contact us at <a href="mailto:support@codeindia.fun">support@codeindia.fun</a> if you have concerns.</p>
  `
  
  const html = _wrapHtml({
    title: "Reset your password - Tech Society",
    preheader: "Reset your Tech Society password securely. This link expires in 1 hour.",
    bodyHtml,
    buttonText: "Reset My Password",
    buttonUrl: url
  })
  
  const text = _generateTextVersion(bodyHtml, "Reset My Password", url)

  await sendMail({
    to,
    subject: "Reset your password - Tech Society Platform",
    html,
    text,
    userId,
    attemptNumber: 1
  })
}

// AUTHOR INVITATION EMAIL
async function sendInvitationEmail({ to, name, inviterName, invitationLink, message, permissions, userId }) {
  const permissionsList = [];
  if (permissions.canWrite) permissionsList.push('Create articles');
  if (permissions.canCollaborate) permissionsList.push('Collaborate on articles');
  if (permissions.canPublish) permissionsList.push('Publish articles');
  if (permissions.canManage) permissionsList.push('Manage article settings');
  
  const bodyHtml = `
    <h2>Author Invitation - Tech Society</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p><strong>${inviterName}</strong> has invited you to join Tech Society as an author.</p>
    
    ${message ? `<div class="info-box"><p><em>"${message}"</em></p></div>` : ''}
    
    <h3>Your Author Permissions:</h3>
    <ul>
      ${permissionsList.map(permission => `<li>${permission}</li>`).join('')}
    </ul>
    
    <div class="warning-box">
      <p><strong>⏰ This invitation expires in 7 days</strong></p>
    </div>
    
    <p><strong>Can't click the button?</strong> Copy and paste this link:</p>
    <div class="code-block">${invitationLink}</div>
  `;
  
  const html = _wrapHtml({
    title: "Author Invitation - Tech Society",
    preheader: `${inviterName} has invited you to become an author on Tech Society`,
    bodyHtml,
    buttonText: "Accept Invitation",
    buttonUrl: invitationLink
  });
  
  const text = _generateTextVersion(bodyHtml, "Accept Invitation", invitationLink);
  
  await sendMail({
    to,
    subject: `Author Invitation from ${inviterName} - Tech Society`,
    html,
    text,
    userId,
    attemptNumber: 1
  });
}

// IMPROVED RESEND VERIFICATION EMAIL
async function resendVerificationEmail({ to, name, token, lastSentAt, userId, attemptNumber = 1 }) {
  // Rate limiting check
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  
  if (lastSentAt && new Date(lastSentAt) > fiveMinutesAgo) {
    const waitTime = Math.ceil((new Date(lastSentAt).getTime() + 5 * 60 * 1000 - now.getTime()) / 60000)
    throw new Error(`Please wait ${waitTime} more minutes before requesting another verification email.`)
  }
  
  const url = `${process.env.CLIENT_URL}/verify-email/${token}`
  const timeStamp = new Date().toLocaleString()
  const attemptText = attemptNumber > 1 ? ` (Resent #${attemptNumber})` : ''
  
  const bodyHtml = `
    <h2>Email Verification${attemptText}</h2>
    <p>Hi <strong>${name || 'there'}</strong>,</p>
    ${attemptNumber > 1 ? 
      `<p>Here's your requested verification link for your Tech Society account:</p>` : 
      `<p>Here's your verification link for your Tech Society account:</p>`
    }
    
    <div class="info-box">
      <p><strong>Quick reminder:</strong> Verifying your email allows you to:</p>
      <ul>
        <li>Access all platform features</li>
        <li>Receive important notifications</li>
        <li>Reset your password when needed</li>
        <li>Join community discussions</li>
      </ul>
    </div>
    
    <div class="warning-box">
      <p><strong>⏰ This link expires in 24 hours</strong></p>
    </div>
    
    <p><strong>Button not working?</strong> Copy and paste this link:</p>
    <div class="code-block">${url}</div>
    
    <!-- Make each email unique -->
    <p style="color:#666;font-size:12px;margin-top:30px;">
      Request sent: ${timeStamp} | Attempt: ${attemptNumber}
    </p>
  `
  
  const subject = attemptNumber > 1 ? 
    `Tech Society - Email verification link (resent #${attemptNumber})` :
    `Tech Society - Email verification link (resent)`
  
  const html = _wrapHtml({
    title: "Email Verification - Tech Society",
    preheader: `Your verification link for Tech Society${attemptText}`,
    bodyHtml,
    buttonText: "Verify My Email Now",
    buttonUrl: url
  })
  
  const text = _generateTextVersion(bodyHtml, "Verify My Email Now", url)

  await sendMail({
    to,
    subject,
    html,
    text,
    userId,
    attemptNumber
  })
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendInvitationEmail,
  resendVerificationEmail
}