const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const formatter = require('../lib/formatters/message-formatter')
const openai = require('../lib/openai')

const router = express.Router()

// Debug endpoint to see raw formatted messages
router.get('/debug/:channelId', autoCatch(async (req, res) => {
  const { channelId } = req.params
  const { startDate, endDate } = req.query

  // Validate required parameters
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate query parameters are required' })
  }

  // Build query
  const query = { channelId }

  // Date range filter
  query.createdAt = {
    $gte: new Date(startDate),
    $lte: new Date(endDate)
  }

  // Get messages
  const messages = await Message.find(query).sort({ createdAt: 1 })

  if (messages.length === 0) {
    return res.status(404).json({ error: 'No messages found for the specified channel and time range' })
  }

  // Format messages into a readable conversation
  const formattedMessages = formatter.formatThreadedMessages(messages)

  res.json({
    channelId,
    startDate,
    endDate,
    messageCount: messages.length,
    formattedMessages
  })
}))

// Summarize messages by channel and time range
router.get('/channel/:channelId', autoCatch(async (req, res) => {
  const {
    channelId
  } = req.params

  const {
    startDate,
    endDate,
    model,
    maxTokens
  } = req.query

  // Validate required parameters
  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'startDate and endDate query parameters are required'
    })
  }

  // Build query
  const query = { channelId }

  // Date range filter
  query.createdAt = {
    $gte: new Date(startDate),
    $lte: new Date(endDate)
  }

  // Get messages
  const messages = await Message.find(query).sort({ createdAt: 1 })

  if (messages.length === 0) {
    return res.status(404).json({
      error: 'No messages found for the specified channel and time range'
    })
  }

  // Format messages into a readable conversation
  const formattedMessages = formatter.formatThreadedMessages(messages)

  // Generate summary using OpenAI
  const options = {}
  if (model) options.model = model
  if (maxTokens) options.maxTokens = parseInt(maxTokens)

  const summary = await openai.summarizeMessages(formattedMessages, options)

  res.json({
    channelId,
    startDate,
    endDate,
    messageCount: messages.length,
    summary: summary.summary,
    usage: summary.usage
  })
}))

module.exports = router
