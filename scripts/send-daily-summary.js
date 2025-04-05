const axios = require('axios')
const config = require('../config')

async function sendDailySummary () {
  try {
    // Configuration
    const port = process.env.PORT || config.port
    const apiUrl = `http://localhost:${port}/email-summary/channel/YOUR_CHANNEL_ID`
    const recipients = ['user1@example.com', 'user2@example.com']

    // Get auth token (implement your auth logic here)
    const token = 'your-auth-token'

    // Send email to each recipient
    for (const recipient of recipients) {
      await axios.post(
        apiUrl,
        {
          to: recipient,
          since: '24h',
          format: 'html'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
      console.log(`Daily summary sent to ${recipient}`)
    }
  } catch (error) {
    console.error('Error sending daily summary:', error.response?.data || error.message)
  }
}

if (require.main === module) {
  sendDailySummary()
}

module.exports = sendDailySummary
