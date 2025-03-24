require('dotenv').config()
const express = require('express')
const healthpoint = require('healthpoint')
const discord = require('./lib/discord')

const app = express()
const port = process.env.PORT || 3000

// Create healthcheck endpoint
const health = healthpoint({
  uptime: true,
  message: 'OK',
  timestamp: true
})

// Routes
app.get('/health', health)

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await discord.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  await discord.stop()
  process.exit(0)
})

discord.start().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
})

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })
}

module.exports = app 