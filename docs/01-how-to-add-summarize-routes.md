# How to Add Message Summarization Routes

This tutorial guides you through the process of adding new API endpoints to summarize Discord messages using OpenAI.

## Prerequisites

- OpenAI API key
- Basic understanding of Express.js routes
- Familiarity with the project structure

## Overview

We'll implement:
1. An OpenAI service module with automatic testing support
2. API endpoints for summarizing messages by time range and channel
3. Formatting logic to prepare Discord messages for summarization

## Step 1: Set Up OpenAI Configuration

First, update the configuration to include OpenAI settings.

Add the following to `config/index.js`:

```javascript
// OpenAI configuration
openaiApiKey: process.env.OPENAI_API_KEY || '',
openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
openaiMaxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS) : 1000
```

Update `.env.example` to include these new environment variables:

```
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
```

Also add these to `.env.test` with test values.

## Step 2: Create OpenAI Module Structure

Create the following file structure:

```
lib/
  openai/
    index.js
    openai.js
    openai-test.js
```

### 2.1 Create the index.js file

This file will determine whether to use the real OpenAI client or the test version:

```javascript
// Export test or production OpenAI client based on environment
module.exports = process.env.NODE_ENV === 'test'
  ? require('./openai-test')
  : require('./openai')
```

### 2.2 Create the openai.js file

This file will handle the actual OpenAI API calls:

```javascript
const { Configuration, OpenAIApi } = require('openai')
const config = require('../../config')

// Initialize OpenAI client on startup
if (!config.openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

const configuration = new Configuration({
  apiKey: config.openaiApiKey
})

const openai = new OpenAIApi(configuration)

// Generate summary for given messages
async function summarizeMessages (messages, options = {}) {
  const model = options.model || config.openaiModel
  const maxTokens = options.maxTokens || config.openaiMaxTokens
  
  try {
    const response = await openai.createChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes Discord conversations. Create a concise summary highlighting key points, questions, and decisions made in the conversation.'
        },
        {
          role: 'user',
          content: `Please summarize the following Discord conversation:\n\n${messages}`
        }
      ],
      max_tokens: maxTokens
    })
    
    return {
      summary: response.data.choices[0].message.content,
      usage: response.data.usage
    }
  } catch (error) {
    console.error('Error generating summary:', error)
    throw error
  }
}

module.exports = {
  summarizeMessages
}
```

### 2.3 Create the openai-test.js file

This file will provide mock responses for testing:

```javascript
// Mock summaries for testing
const MOCK_SUMMARIES = {
  default: 'This is a mock summary of the conversation.',
  short: 'Brief mock summary.',
  long: 'This is an extended mock summary with multiple points discussed in the conversation. The participants talked about various topics including project updates, technical issues, and future plans.'
}

// Mock OpenAI client for testing
async function summarizeMessages (messages, options = {}) {
  // Determine which mock to return based on message length
  let summaryType = 'default'
  
  if (messages.length < 100) {
    summaryType = 'short'
  } else if (messages.length > 1000) {
    summaryType = 'long'
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))
  
  return {
    summary: MOCK_SUMMARIES[summaryType],
    usage: {
      prompt_tokens: messages.length,
      completion_tokens: MOCK_SUMMARIES[summaryType].length,
      total_tokens: messages.length + MOCK_SUMMARIES[summaryType].length
    }
  }
}

module.exports = {
  summarizeMessages
}
```

## Step 3: Create Message Formatter Module

Create a new module to format messages similar to what's used in `scripts/format-messages.js`.

Create `lib/formatters/message-formatter.js`:

```javascript
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

function formatThreadedMessages (messages) {
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

module.exports = {
  buildMessageMap,
  formatMessage,
  formatThreadedMessages
}
```

## Step 4: Create Summarize API Routes

Create a new file for the summarize endpoints at `api/summarize.js`:

```javascript
const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const formatter = require('../lib/formatters/message-formatter')
const openai = require('../lib/openai')

const router = express.Router()

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
```

## Step 5: Update Server.js to Include the New Routes

Update `server.js` to include the new summarize routes:

```javascript
// Add this line with the other requires
const summarizeRouter = require('./api/summarize')

// Add this line where you define the other routes
if (process.env.NODE_ENV === 'test') {
  // In test environment, use mock auth
  const mockAuth = require('./test/helpers/mock-auth')
  app.use('/messages', mockAuth, messagesRouter)
  app.use('/summarize', mockAuth, summarizeRouter) // Add this line
} else {
  app.use('/messages', messagesRouter)
  app.use('/summarize', summarizeRouter) // Add this line
}
```

## Step 6: Add Tests for the Summarize Module

Create a test file at `test/api/summarize.test.js`:

```javascript
const test = require('tape')
const request = require('supertest')
const Message = require('../../models/message')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

test('GET /summarize/channel/:channelId - returns 400 without date range', async t => {
  const response = await request(app)
    .get('/summarize/channel/channel1')
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 400)
  t.ok(response.body.error.includes('startDate and endDate'))
  t.end()
})

test('GET /summarize/channel/:channelId - returns 404 when no messages found', async t => {
  const response = await request(app)
    .get('/summarize/channel/nonexistent')
    .query({
      startDate: '2023-01-01',
      endDate: '2023-01-02'
    })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 404)
  t.end()
})

test('GET /summarize/channel/:channelId - returns summary of messages', async t => {
  // Create some test messages
  const messages = [
    {
      id: 'sum1',
      content: 'test message 1',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel-summary',
      guildId: 'guild1',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      attachments: [],
      embeds: []
    },
    {
      id: 'sum2',
      content: 'test message 2',
      authorId: 'user2',
      authorUsername: 'testuser2',
      channelId: 'channel-summary',
      guildId: 'guild1',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      attachments: [],
      embeds: []
    }
  ]

  await Message.insertMany(messages)

  const response = await request(app)
    .get('/summarize/channel/channel-summary')
    .query({
      startDate: '2024-01-01',
      endDate: '2024-01-02'
    })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 200)
  t.equal(response.body.channelId, 'channel-summary')
  t.equal(response.body.messageCount, 2)
  t.ok(response.body.summary, 'Has summary text')
  t.ok(response.body.usage, 'Has token usage information')
  t.end()
})
```

## Step 7: Install Required Dependencies

Install the OpenAI package:

```bash
npm install openai@^3.2.1
```

## Usage Examples

### Channel Summarization

```bash
# Get summary of channel messages for a specific time range
curl -X GET "http://localhost:3000/summarize/channel/123456789012345678?startDate=2023-11-01&endDate=2023-11-30" \
  -H "Authorization: Bearer your-auth-token"
```

## Conclusion

You've now added OpenAI-powered summarization endpoints to your Discord message archive. This allows you to quickly get insights from conversations without having to read through all the messages.

The implementation follows the project's patterns by:
1. Creating a modular OpenAI service with testing support
2. Reusing the message formatting logic 
3. Following the existing patterns for API routes and error handling

Remember to update your environment variables with your OpenAI API key before using these endpoints. 