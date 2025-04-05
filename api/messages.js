const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const messageFormatter = require('../lib/message-formatter')

const router = express.Router()

// Get messages with pagination and filtering
router.get('/', autoCatch(async (req, res) => {
  const {
    guildId,
    channelId,
    authorId,
    startDate,
    endDate,
    page = 1,
    limit = 50,
    format = 'json'
  } = req.query

  // Build query
  const query = {}
  if (guildId) query.guildId = guildId
  if (channelId) query.channelId = channelId
  if (authorId) query.authorId = authorId

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) query.createdAt.$lte = new Date(endDate)
  }

  // Execute query with pagination
  const skip = (page - 1) * limit
  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))

  // Get total count for pagination
  const total = await Message.countDocuments(query)

  // Handle TXT format separately
  if (format.toLowerCase() === 'txt') {
    res.setHeader('Content-Type', 'text/plain')
    const formattedText = messageFormatter.formatMessages(messages, { format: 'txt' })
    return res.send(formattedText)
  }

  // Default JSON response
  res.json({
    messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  })
}))

// Get a single message by ID
router.get('/:id', autoCatch(async (req, res) => {
  const message = await Message.findOne({ id: req.params.id })

  if (!message) {
    return res.status(404).json({ error: 'Message not found' })
  }

  res.json(message)
}))

// Get messages from a specific thread
router.get('/thread/:threadId', autoCatch(async (req, res) => {
  const { page = 1, limit = 50, format = 'json' } = req.query
  const skip = (page - 1) * limit

  const messages = await Message.find({ threadId: req.params.threadId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(parseInt(limit))

  const total = await Message.countDocuments({ threadId: req.params.threadId })

  // Handle TXT format separately
  if (format.toLowerCase() === 'txt') {
    res.setHeader('Content-Type', 'text/plain')
    const formattedText = messageFormatter.formatMessages(messages, { format: 'txt' })
    return res.send(formattedText)
  }

  // Default JSON response
  res.json({
    messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  })
}))

module.exports = router
