const mailgun = require('mailgun-js')
const config = require('../../config')

// Initialize Mailgun client
if (!config.mailgunApiKey) {
  throw new Error('MAILGUN_API_KEY environment variable is required')
}

if (!config.mailgunDomain) {
  throw new Error('MAILGUN_DOMAIN environment variable is required')
}

const mg = mailgun({
  apiKey: config.mailgunApiKey,
  domain: config.mailgunDomain
})

/**
 * Send an email using Mailgun
 * @param {Object} options Email options
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.text Plain text email body
 * @param {string} [options.html] HTML email body (optional)
 * @returns {Promise<Object>} Mailgun response
 */
async function sendEmail (options) {
  if (!options.to) throw new Error('Recipient email (to) is required')
  if (!options.subject) throw new Error('Email subject is required')
  if (!options.text && !options.html) throw new Error('Email body (text or html) is required')

  const data = {
    from: config.mailgunFrom,
    to: options.to,
    subject: options.subject,
    text: options.text || ''
  }

  if (options.html) {
    data.html = options.html
  }

  try {
    return await mg.messages().send(data)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

module.exports = {
  sendEmail
}
