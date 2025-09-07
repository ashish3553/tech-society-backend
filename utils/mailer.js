// utils/mailer.js - Clean version without any model definitions
const mailjet = require('node-mailjet')
  .apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET
  )

const sendEmail = async ({ to, subject, text, html, from }) => {
  let recipients
  if (Array.isArray(to)) {
    recipients = to
  } else if (typeof to === 'string') {
    recipients = to.split(',').map(email => ({ Email: email.trim() }))
  } else {
    throw new Error('Invalid "to" field provided.')
  }

  try {
    const { body } = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: from || process.env.DEFAULT_FROM_EMAIL,
              Name: 'Tech Society'
            },
            To: recipients,
            Subject: subject,
            TextPart: text,
            HTMLPart: html
          }
        ]
      })
    console.log('Mailjet response:', body)
    return body
  } catch (err) {
    console.error('Mailjet error:', err.statusCode, err.message)
    throw err
  }
}

module.exports = sendEmail