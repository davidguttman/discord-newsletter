require('dotenv').config()
const express = require('express')
const config = require('./config')
const mongoose = require('./lib/mongo')
const discord = require('./lib/discord')
const messagesRouter = require('./api/messages')
const summarizeRouter = require('./api/summarize')
const emailSummaryRouter = require('./api/email-summary')
const settingsRouter = require('./api/settings')
const { router: guildsRouter, setDiscordClient } = require('./api/guilds')
const { router: previewRouter, setDiscordClient: setPreviewDiscordClient } = require('./api/preview')
const healthpoint = require('healthpoint')
const budo = require('budo')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()

// Dev server setup
let budoServer
async function setupDevServer () {
  if (process.env.NODE_ENV !== 'production') {
    const getPortModule = await import('get-port')
    const getPort = getPortModule.default
    const budoPort = await getPort()
    console.log(`Found available port: ${budoPort}`)
    console.log(`Starting budo dev server on port ${budoPort}`)

    return new Promise((resolve, reject) => {
      budoServer = budo('client/index.js', {
        live: true,
        stream: process.stdout,
        port: budoPort,
        portfind: false, // Don't find port, use the one I specified
        dir: 'dist',
        pushstate: true
      })

      budoServer.on('connect', (ev) => {
        console.log(`Budo server running at http://localhost:${ev.port}`)

        // Proxy root requests to budo in dev
        app.use('/', (req, res, next) => {
          // Skip API routes
          if (req.path.startsWith('/messages') ||
              req.path.startsWith('/summarize') ||
              req.path.startsWith('/email-summary') ||
              req.path.startsWith('/settings') ||
              req.path.startsWith('/guilds') ||
              req.path.startsWith('/preview') ||
              req.path.startsWith('/health')) {
            return next()
          }
          // Proxy to budo server
          const proxy = createProxyMiddleware({
            target: `http://localhost:${ev.port}`,
            changeOrigin: true,
            ws: true
          })
          proxy(req, res, next)
        })

        resolve()
      })

      budoServer.on('error', reject)
    })
  } else {
    // Serve static files from dist directory in production
    app.use(express.static('dist'))
  }
}

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
  app.use('/messages', mockAuth, messagesRouter)
  app.use('/summarize', mockAuth, summarizeRouter)
  app.use('/email-summary', mockAuth, emailSummaryRouter)
  app.use('/settings', mockAuth, settingsRouter)
  app.use('/guilds', mockAuth, guildsRouter)
  app.use('/preview', mockAuth, previewRouter)
} else {
  app.use('/messages', messagesRouter)
  app.use('/summarize', summarizeRouter)
  app.use('/email-summary', emailSummaryRouter)
  app.use('/settings', settingsRouter)
  app.use('/guilds', guildsRouter)
  app.use('/preview', previewRouter)
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

  // Start dev server and setup
  setupDevServer().then(() => {
    // Start Discord client (don't exit on failure, allow settings configuration)
    discord.start().then(() => {
      // Set Discord client reference for guilds and preview APIs
      const client = discord.getClient()
      setDiscordClient(client)
      setPreviewDiscordClient(client)
      console.log('Discord client started successfully')
    }).catch(err => {
      console.error('Failed to start Discord client:', err.message)
      console.log('Server will continue running to allow settings configuration')
      // Don't exit - allow the server to run so users can configure settings
    })

    app.listen(port, () => {
      console.log('Server started on port', port)
    })
  }).catch(err => {
    console.error('Failed to setup dev server:', err)
    process.exit(1)
  })

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...')
    if (budoServer && budoServer.close) {
      budoServer.close()
    }
    await discord.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('Shutting down...')
    if (budoServer && budoServer.close) {
      budoServer.close()
    }
    await discord.stop()
    process.exit(0)
  })
}

module.exports = app
