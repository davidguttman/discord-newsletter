require('dotenv').config()
const express = require('express')
const config = require('./config')
const mongoose = require('./lib/mongo')
const widgetsRouter = require('./api/widgets')
const messagesRouter = require('./api/messages')
const healthpoint = require('healthpoint')

const app = express()

// Middleware
app.use(express.json())

// Create healthcheck endpoint with healthpoint
const health = healthpoint(
  function (cb) {
    mongoose
      .checkHealth()
      .then(() => cb())
      .catch(cb)
  }
)

// Health check endpoint
app.get('/health', health)

// API routes
if (process.env.NODE_ENV === 'test') {
  // In test environment, use mock auth
  const mockAuth = require('./test/helpers/mock-auth')
  app.use('/widgets', mockAuth, widgetsRouter)
  app.use('/messages', mockAuth, messagesRouter)
} else {
  app.use('/widgets', widgetsRouter)
  app.use('/messages', messagesRouter)
}

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err)
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message })
  }

  // Handle other errors
  res
    .status(err.status || 500)
    .json({ error: err.message || 'Internal Server Error' })
})

// Only start the server if this file is run directly
if (require.main === module) {
  const port = config.port
  app.listen(port, () => {
    console.log('Server started on port', port)
  })
}

module.exports = app
