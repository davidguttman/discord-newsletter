require('dotenv').config()
const productionize = require('productionize')

// Default configuration
const defaults = {
  port: 3000,
  mongoUri: 'mongodb://localhost:27017/',
  mongoDbName: 'example',
  googleProjectId: '',
  googleApplicationCredentials: '',
  authenticServer: '',
  whitelist: ['david@davidguttman.com'],
  // OpenAI configuration
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiMaxTokens: 10000,
  // Mailgun configuration
  mailgunApiKey: '',
  mailgunDomain: '',
  mailgunFrom: 'Discord Newsletter <newsletter@example.com>'
}

// Merge defaults with environment variables
const config = {
  ...defaults,
  port: process.env.PORT || defaults.port,
  mongoUri: process.env.MONGO_URI || defaults.mongoUri,
  mongoDbName: process.env.MONGO_DB_NAME || defaults.mongoDbName,
  googleProjectId: process.env.GOOGLE_PROJECT_ID || defaults.googleProjectId,
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || defaults.googleApplicationCredentials,
  authenticServer: process.env.AUTHENTIC_SERVER || defaults.authenticServer,
  whitelist: (process.env.WHITELIST || defaults.whitelist.join(',')).split(','),
  // OpenAI configuration
  openaiApiKey: process.env.OPENAI_API_KEY || defaults.openaiApiKey,
  openaiModel: process.env.OPENAI_MODEL || defaults.openaiModel,
  openaiMaxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS) : defaults.openaiMaxTokens,
  // Mailgun configuration
  mailgunApiKey: process.env.MAILGUN_API_KEY || defaults.mailgunApiKey,
  mailgunDomain: process.env.MAILGUN_DOMAIN || defaults.mailgunDomain,
  mailgunFrom: process.env.MAILGUN_FROM || defaults.mailgunFrom
}

// Configure logging based on environment
const logger = productionize({
  projectId: config.googleProjectId,
  keyFilename: config.googleApplicationCredentials,
  defaultMetadata: {
    service: 'dg-node-express'
  }
})

// Configure auth
const auth = require('authentic-service')({
  server: config.authenticServer
})

module.exports = {
  ...config,
  logger,
  auth
}
