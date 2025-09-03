require('dotenv').config()
const productionize = require('productionize')

// Default configuration
const defaults = {
  port: 3000,
  mongoUri: 'mongodb://localhost:27017/',
  mongoDbName: 'discord-newsletter',
  googleProjectId: '',
  googleApplicationCredentials: '',
  authenticServer: '',
  whitelist: ['david@davidguttman.com'],
  // OpenAI configuration
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiMaxTokens: 10000,
  // OpenRouter configuration
  openrouterApiKey: '',
  // Mailgun configuration
  mailgunApiKey: '',
  mailgunDomain: '',
  mailgunFrom: 'Discord Newsletter <newsletter@example.com>',
  // BrainyFlow configuration
  useBrainyFlow: false,
  brainyFlowMaxVisits: 10,
  brainyFlowTimeout: 300000, // 5 minutes
  brainyFlowRetryCount: 3,
  brainyFlowBatchSize: 5
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
  // OpenRouter configuration
  openrouterApiKey: process.env.OPENROUTER_API_KEY || defaults.openrouterApiKey,
  // Mailgun configuration
  mailgunApiKey: process.env.MAILGUN_API_KEY || defaults.mailgunApiKey,
  mailgunDomain: process.env.MAILGUN_DOMAIN || defaults.mailgunDomain,
  mailgunFrom: process.env.MAILGUN_FROM || defaults.mailgunFrom,
  // BrainyFlow configuration
  useBrainyFlow: process.env.USE_BRAINYFLOW === 'true' || defaults.useBrainyFlow,
  brainyFlowMaxVisits: process.env.BRAINYFLOW_MAX_VISITS ? parseInt(process.env.BRAINYFLOW_MAX_VISITS) : defaults.brainyFlowMaxVisits,
  brainyFlowTimeout: process.env.BRAINYFLOW_TIMEOUT ? parseInt(process.env.BRAINYFLOW_TIMEOUT) : defaults.brainyFlowTimeout,
  brainyFlowRetryCount: process.env.BRAINYFLOW_RETRY_COUNT ? parseInt(process.env.BRAINYFLOW_RETRY_COUNT) : defaults.brainyFlowRetryCount,
  brainyFlowBatchSize: process.env.BRAINYFLOW_BATCH_SIZE ? parseInt(process.env.BRAINYFLOW_BATCH_SIZE) : defaults.brainyFlowBatchSize
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
