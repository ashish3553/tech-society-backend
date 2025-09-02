// lib/mail.js
const Mailjet = require('node-mailjet')
  .apiConnect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET)

async function sendMail({ to, subject, html }) {
  await Mailjet
    .post("send", { version: "v3.1" })
    .request({
      Messages: [{
        From: {
          Email: process.env.DEFAULT_FROM_EMAIL,
          Name:  "Tech Society"
        },
        To: [{ Email: to }],
        Subject:  subject,
        HTMLPart: html
      }]
    })
}

function _wrapHtml({ title, preheader, bodyHtml, buttonText, buttonUrl }) {
  return `
    <!DOCTYPE html>
    <html lang="en" style="margin:0;padding:0;">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { margin:0; padding:0; background:#f4f4f7; font-family:Arial,sans-serif; }
        .container { max-width:600px; margin:40px auto; background:#ffffff; border-radius:8px; overflow:hidden; }
        .header { background:#4f46e5; color:#fff; padding:20px; text-align:center; }
        .content { padding:30px; color:#333; line-height:1.5; }
        .button { display:inline-block; margin:20px 0; padding:12px 24px; background:#4f46e5; color:#fff; text-decoration:none; border-radius:4px; }
        .footer { font-size:12px; color:#888; text-align:center; padding:20px; }
        a { color:#4f46e5; }
        @media (max-width: 600px) {
          .container { margin:20px 10px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Tech Society</h1>
        </div>
        <div class="content">
          <!-- hidden preheader text for email clients -->
          <span style="display:none;font-size:1px;color:#f4f4f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
            ${preheader}
          </span>
          ${bodyHtml}
          ${buttonText && buttonUrl ? `<p style="text-align:center;">
            <a href="${buttonUrl}" class="button">${buttonText}</a>
          </p>` : ''}
        </div>
        <div class="footer">
          If you didn’t request this, you can safely ignore this email.<br>
          &copy; ${new Date().getFullYear()} Tech Society
        </div>
      </div>
    </body>
    </html>
  `
}

async function sendVerificationEmail({ to, name, token }) {
  const url = `${process.env.CLIENT_URL}/verify-email/${token}`
  const html = _wrapHtml({
    title: "Verify your email",
    preheader: "Confirm your address at Tech Society",
    bodyHtml: `
      <p>Hi ${name || 'there'},</p>
      <p>Thank you for registering with Tech Society! Please confirm your email address by clicking the button below:</p>
    `,
    buttonText: "Verify Email",
    buttonUrl: url
  })

  await sendMail({
    to,
    subject: "Please verify your email – Tech Society",
    html
  })
}

async function sendResetPasswordEmail({ to, name, token }) {
  const url = `${process.env.CLIENT_URL}/reset-password/${token}`
  const html = _wrapHtml({
    title: "Reset your password",
    preheader: "Use this link to reset your Tech Society password",
    bodyHtml: `
      <p>Hi ${name || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    `,
    buttonText: "Reset Password",
    buttonUrl: url
  })

  await sendMail({
    to,
    subject: "Reset your password – Tech Society",
    html
  })
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendResetPasswordEmail
}
