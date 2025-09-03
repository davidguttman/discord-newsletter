// Utility functions for BrainyFlow integration

const Message = require('../../models/message')
const messageFormatter = require('../message-formatter')
const ms = require('ms')

/**
 * Create a standardized memory store for Discord newsletter flows
 * @param {Object} params - Flow parameters
 * @returns {Memory} Initialized BrainyFlow memory
 */
function createDiscordMemory (params = {}) {
  const memory = {
    // Input parameters
    guildId: params.guildId || null,
    channelId: params.channelId || null,
    since: params.since || '24h',
    options: params.options || {},

    // Will be populated by nodes
    messages: [],
    formattedMessages: '',
    topics: [],
    stories: [],
    catchallStory: '',
    summary: '',
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    metadata: {},

    // Email specific
    emailContent: '',
    emailSubject: ''
  }

  return memory
}

/**
 * Calculate date range from 'since' parameter
 * @param {string} since - Time period like '24h', '1d', '7d'
 * @returns {Object} { startDate, endDate, duration }
 */
function calculateDateRange (since) {
  const duration = ms(since)
  if (!duration) {
    throw new Error(`Invalid time period format: ${since}. Use values like "24h", "1d", "7d", etc.`)
  }

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - duration)

  return { startDate, endDate, duration }
}

/**
 * Fetch messages from MongoDB for a given channel and time range
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {Date} startDate - Start of time range
 * @param {Date} endDate - End of time range
 * @returns {Promise<Array>} Array of Discord messages
 */
async function fetchChannelMessages (guildId, channelId, startDate, endDate) {
  const query = {
    guildId,
    channelId,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }

  return await Message.find(query).sort({ createdAt: 1 })
}

/**
 * Format messages for AI processing
 * @param {Array} messages - Array of Discord messages
 * @param {Object} options - Formatting options
 * @returns {string} Formatted conversation text
 */
function formatMessagesForAI (messages, options = {}) {
  return messageFormatter.formatMessages(messages, { format: 'txt', ...options })
}

/**
 * Log with optional debug collection
 * @param {string} message - Log message
 * @param {string} step - Step identifier
 * @param {Array} debugSteps - Optional debug collection array
 */
function debugLog (message, step = null, debugSteps = null) {
  console.log(message)
  if (debugSteps) {
    debugSteps.push({ message, step, timestamp: new Date() })
  }
}

/**
 * Accumulate OpenAI usage statistics
 * @param {Object} totalUsage - Running total usage object
 * @param {Object} newUsage - New usage to add
 */
function accumulateUsage (totalUsage, newUsage) {
  if (newUsage) {
    totalUsage.prompt_tokens += newUsage.prompt_tokens || 0
    totalUsage.completion_tokens += newUsage.completion_tokens || 0
    totalUsage.total_tokens += newUsage.total_tokens || 0
  }
}

/**
 * Remove duplicate URLs from text content
 * @param {string} text - Text content with potential duplicate URLs
 * @returns {Object} { cleanedText, duplicatesRemoved }
 */
function deduplicateUrls (text) {
  const urlPattern = /(https?:\/\/[^\s\])]+)/g
  const urls = text.match(urlPattern) || []

  const seenUrls = new Set()
  const cleanedText = text.replace(urlPattern, (match) => {
    if (seenUrls.has(match)) {
      return '' // Remove duplicate
    }
    seenUrls.add(match)
    return match
  })

  return {
    cleanedText,
    duplicatesRemoved: urls.length - seenUrls.size
  }
}

module.exports = {
  createDiscordMemory,
  calculateDateRange,
  fetchChannelMessages,
  formatMessagesForAI,
  debugLog,
  accumulateUsage,
  deduplicateUrls
}
