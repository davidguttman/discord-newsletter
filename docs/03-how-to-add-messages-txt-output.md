# Adding TXT Output Format to the Discord Newsletter System

This document outlines how to implement a TXT output format for Discord messages across the application by refactoring the existing code and creating a reusable message formatter module.

## Overview of Changes

1. Extract message formatting logic from `scripts/format-messages.js` into a reusable module
2. Replace the broken formatter in `/lib/formatters/message-formatter.js`
3. Add TXT format support to the `/api/messages` endpoint
4. Update the `/api/summarize` endpoint to use the new formatter
5. Update the `/api/email-summary` endpoint to use the new formatter

## Step 1: Create a Reusable Message Formatter Module

Create a new file at `lib/message-formatter.js` that extracts and enhances the existing message formatting logic:

```javascript
// lib/message-formatter.js

/**
 * A utility module for formatting Discord messages in different formats
 */

/**
 * Builds a data structure to represent message threads and replies
 * @param {Array} messages - Array of message objects from the database
 * @returns {Object} Object containing messageMap, threadMap, and rootMessages
 */
function buildMessageMap (messages) {
  const messageMap = new Map()
  const threadMap = new Map()
  const rootMessages = []

  // First pass: Create maps
  messages.forEach(msg => {
    messageMap.set(msg.id, {
      ...msg,
      replies: [],
      indent: 0
    })

    if (msg.threadId) {
      if (!threadMap.has(msg.threadId)) {
        threadMap.set(msg.threadId, [])
      }
      threadMap.get(msg.threadId).push(msg.id)
    }
  })

  // Second pass: Build reply chains
  messages.forEach(msg => {
    if (msg.replyToId) {
      const parent = messageMap.get(msg.replyToId)
      if (parent) {
        parent.replies.push(msg.id)
        messageMap.get(msg.id).indent = parent.indent + 1
      } else {
        rootMessages.push(msg.id)
      }
    } else if (!msg.threadId) {
      rootMessages.push(msg.id)
    }
  })

  return { messageMap, threadMap, rootMessages }
}

/**
 * Formats a single message for text output
 * @param {Object} msg - Message object
 * @param {Number} indent - Indentation level
 * @returns {String} Formatted message string
 */
function formatMessage (msg, indent = 0) {
  const timestamp = new Date(msg.createdAt).toLocaleString()
  const prefix = '  '.repeat(indent)
  let output = `${prefix}[${timestamp}] ${msg.authorUsername}: ${msg.content}`

  if (msg.embeds && msg.embeds.length > 0) {
    msg.embeds.forEach(embed => {
      output += '\n' + prefix + '  [Embed]'
      if (embed.title) output += `\n${prefix}    Title: ${embed.title}`
      if (embed.description) output += `\n${prefix}    Description: ${embed.description}`
      if (embed.url) output += `\n${prefix}    URL: ${embed.url}`
    })
  }

  if (msg.attachments && msg.attachments.length > 0) {
    msg.attachments.forEach(attachment => {
      output += `\n${prefix}  [Attachment: ${attachment.url}]`
    })
  }

  return output
}

/**
 * Formats messages into a threaded text representation
 * @param {Array} messages - Array of message objects from the database
 * @returns {String} Formatted messages as text
 */
function formatMessagesAsText (messages) {
  // For small message sets, use a simpler approach
  if (messages.length <= 10) {
    return messages.map(msg => formatMessage(msg, 0)).join('\n')
  }

  // For larger message sets with threading
  const { messageMap, threadMap, rootMessages } = buildMessageMap(messages)
  let output = ''

  function processMessage (messageId, seenMessages = new Set()) {
    if (seenMessages.has(messageId)) return ''
    seenMessages.add(messageId)

    const msg = messageMap.get(messageId)
    if (!msg) return ''

    let messageOutput = formatMessage(msg, msg.indent) + '\n'

    // Process replies
    msg.replies.forEach(replyId => {
      messageOutput += processMessage(replyId, seenMessages)
    })

    // If this is a thread starter, process thread messages
    const threadMessages = threadMap.get(messageId)
    if (threadMessages) {
      threadMessages.forEach(threadMessageId => {
        const threadMsg = messageMap.get(threadMessageId)
        if (threadMsg) {
          messageOutput += formatMessage(threadMsg, msg.indent + 1) + '\n'
        }
      })
    }

    return messageOutput
  }

  rootMessages.forEach(messageId => {
    output += processMessage(messageId)
  })

  return output
}

/**
 * Main formatter function that formats messages based on the specified format
 * @param {Array} messages - Array of message objects from the database
 * @param {Object} options - Options object
 * @param {String} options.format - Format to use (currently supports 'txt' or 'json')
 * @returns {String|Object} Formatted messages in the requested format
 */
function formatMessages (messages, options = {}) {
  const { format = 'json' } = options

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return format === 'txt' ? '' : []
  }

  switch (format.toLowerCase()) {
    case 'txt':
      return formatMessagesAsText(messages)
    case 'json':
    default:
      return messages
  }
}

module.exports = {
  buildMessageMap,
  formatMessage,
  formatMessagesAsText,
  formatMessages
}
```

## Step 2: Remove the Broken Message Formatter

Remove the existing message formatter at `/lib/formatters/message-formatter.js` and update imports across the codebase to use the new module.

```bash
rm lib/formatters/message-formatter.js
```

## Step 3: Update the Messages API to Support TXT Format

Modify the `api/messages.js` file to add support for the TXT format:

```javascript
// In api/messages.js

const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const messageFormatter = require('../lib/message-formatter') // Replace old formatter import

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
    format = 'json' // Add format option
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

// Update the thread endpoint to also support TXT format
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

// ... rest of the code remains the same
```

## Step 4: Update the Summarize API to Use the New Formatter

Update the `api/summarize.js` file:

```javascript
// In api/summarize.js

const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const messageFormatter = require('../lib/message-formatter') // Update import
const openai = require('../lib/openai')
const marked = require('marked')

const router = express.Router()

// Debug endpoint to see raw formatted messages
router.get('/debug/:channelId', autoCatch(async (req, res) => {
  const { channelId } = req.params
  const { startDate, endDate, format = 'json' } = req.query // Add format option

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

  // Format messages based on requested format
  const formattedMessages = messageFormatter.formatMessages(messages, { format })

  // Handle TXT format separately
  if (format.toLowerCase() === 'txt') {
    res.setHeader('Content-Type', 'text/plain')
    return res.send(formattedMessages)
  }

  // Default JSON response
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
  // ... existing code ...

  // Format messages into a readable conversation
  const formattedMessages = messageFormatter.formatMessages(messages, { format: 'txt' })

  // ... rest of the code remains the same
}))

// ... rest of the file remains the same
```

## Step 5: Update the Email Summary API to Use the New Formatter

Update the `api/email-summary.js` file:

```javascript
// In api/email-summary.js

const express = require('express')
const ms = require('ms')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const messageFormatter = require('../lib/message-formatter') // Update import
const openai = require('../lib/openai')
const email = require('../lib/email')
const marked = require('marked')

const router = express.Router()

// Send email summary of channel messages
router.post('/channel/:channelId', autoCatch(async (req, res) => {
  // ... existing code ...

  // Format messages into a readable conversation
  const formattedMessages = messageFormatter.formatMessages(messages, { format: 'txt' })

  // ... rest of the code remains the same
}))

// ... rest of the file remains the same
```

## Step 6: Update the Format Messages Script

Update the `scripts/format-messages.js` script to use the new module:

```javascript
// In scripts/format-messages.js

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
```

## Testing

After implementing these changes, test each endpoint to verify the TXT format support:

1. Test the messages API:
   ```
   curl http://localhost:3000/messages?format=txt
   ```

2. Test the thread endpoint:
   ```
   curl http://localhost:3000/messages/thread/123456789?format=txt
   ```

3. Test the summarize debug endpoint:
   ```
   curl http://localhost:3000/summarize/debug/123456789?startDate=2024-01-01&endDate=2024-01-02&format=txt
   ```

4. Run the format-messages script:
   ```
   node scripts/format-messages.js
   ```
