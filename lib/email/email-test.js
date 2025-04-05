/**
 * Mock email client for testing
 * @param {Object} options Email options
 * @returns {Promise<Object>} Mock response
 */
async function sendEmail (options) {
  // Log the email for debugging in tests
  console.log('MOCK EMAIL:', {
    to: options.to,
    subject: options.subject,
    textLength: options.text ? options.text.length : 0,
    htmlLength: options.html ? options.html.length : 0
  })

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return {
    id: `mock-email-${Date.now()}`,
    message: 'Queued. Thank you.',
    status: 'success'
  }
}

module.exports = {
  sendEmail
}
