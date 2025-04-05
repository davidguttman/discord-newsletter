const https = require('https')
const messageFormatter = require('../lib/message-formatter') // Import the new module

// Constants
const DISCORD_API = 'discord-newsletter.thhis.com'
const START_DATE = '2025-04-03T00:00:00.000Z'
const END_DATE = '2025-04-04T00:00:00.000Z'
const LIMIT = 5000

function fetchMessages () {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: DISCORD_API,
      path: `/messages?startDate=${START_DATE}&endDate=${END_DATE}&limit=${LIMIT}`,
      method: 'GET'
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(JSON.parse(data)))
    })

    req.on('error', reject)
    req.end()
  })
}

async function main () {
  try {
    const response = await fetchMessages()
    const messages = response.messages
    // Use the new formatter module instead of the old functions
    const output = messageFormatter.formatMessages(messages, { format: 'txt' })
    console.log(output)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  fetchMessages
}
