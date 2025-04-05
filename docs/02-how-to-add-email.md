# How to Add Email Summary Functionality

This tutorial guides you through adding email functionality to send Discord channel summaries via email.

## Prerequisites

- Mailgun account with API key
- Understanding of the existing project structure and summary functionality
- Familiarity with Express.js routes

## Step 1: Install Required Dependencies

```bash
npm install mailgun-js ms
```

## Step 2: Update Configuration

First, add Mailgun configuration to `config/index.js`:

```javascript
// Mailgun configuration
mailgunApiKey: process.env.MAILGUN_API_KEY || '',
mailgunDomain: process.env.MAILGUN_DOMAIN || '',
mailgunFrom: process.env.MAILGUN_FROM || 'Discord Newsletter <newsletter@example.com>'
```

Then update `.env.example` to include these new environment variables:

```
# Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
MAILGUN_FROM=Discord Newsletter <newsletter@yourdomain.com>
```

Also add these to `.env.test` with test values.

## Step 3: Create Email Module Structure

Create the following file structure:

```
lib/
  email/
    index.js
    email.js
    email-test.js
```

### 3.1 Create the index.js file

```javascript
// Export test or production email client based on environment
module.exports = process.env.NODE_ENV === 'test'
  ? require('./email-test')
  : require('./email')
```

### 3.2 Create the email.js file

```javascript
const mailgun = require('mailgun-js')
const config = require('../../config')

// Initialize Mailgun client
if (!config.mailgunApiKey) {
  throw new Error('MAILGUN_API_KEY environment variable is required')
}

if (!config.mailgunDomain) {
  throw new Error('MAILGUN_DOMAIN environment variable is required')
}

const mg = mailgun({
  apiKey: config.mailgunApiKey,
  domain: config.mailgunDomain
})

/**
 * Send an email using Mailgun
 * @param {Object} options Email options
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.text Plain text email body
 * @param {string} [options.html] HTML email body (optional)
 * @returns {Promise<Object>} Mailgun response
 */
async function sendEmail(options) {
  if (!options.to) throw new Error('Recipient email (to) is required')
  if (!options.subject) throw new Error('Email subject is required')
  if (!options.text && !options.html) throw new Error('Email body (text or html) is required')

  const data = {
    from: config.mailgunFrom,
    to: options.to,
    subject: options.subject,
    text: options.text || ''
  }

  if (options.html) {
    data.html = options.html
  }

  try {
    return await mg.messages().send(data)
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

module.exports = {
  sendEmail
}
```

### 3.3 Create the email-test.js file

```javascript
/**
 * Mock email client for testing
 * @param {Object} options Email options
 * @returns {Promise<Object>} Mock response
 */
async function sendEmail(options) {
  // Log the email for debugging in tests
  console.log('MOCK EMAIL:', {
    to: options.to,
    subject: options.subject,
    textLength: options.text ? options.text.length : 0,
    htmlLength: options.html ? options.html.length : 0
  })

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return {
    id: `mock-email-${Date.now()}`,
    message: 'Queued. Thank you.',
    status: 'success'
  }
}

module.exports = {
  sendEmail
}
```

## Step 4: Create Email Summary API Endpoint

Create a new file at `api/email-summary.js`:

```javascript
const express = require('express')
const ms = require('ms')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const formatter = require('../lib/formatters/message-formatter')
const openai = require('../lib/openai')
const email = require('../lib/email')
const marked = require('marked')

const router = express.Router()

// Send email summary of channel messages
router.post('/channel/:channelId', autoCatch(async (req, res) => {
  const { channelId } = req.params
  const { to, since, format, model, maxTokens } = req.body

  // Validate required parameters
  if (!to) {
    return res.status(400).json({ error: 'Email recipient (to) is required' })
  }

  if (!since) {
    return res.status(400).json({ error: 'Time period (since) is required' })
  }

  // Calculate start date based on 'since' parameter
  let duration
  try {
    duration = ms(since)
  } catch (err) {
    return res.status(400).json({ error: 'Invalid time period format. Use values like "24h", "1d", "7d", etc.' })
  }

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - duration)

  // Build query
  const query = { channelId }
  query.createdAt = {
    $gte: startDate,
    $lte: endDate
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

  // Format email subject
  const startDateStr = startDate.toLocaleDateString()
  const endDateStr = endDate.toLocaleDateString()
  const subject = `Discord Channel Summary (${startDateStr} to ${endDateStr})`

  // Send email
  const emailResult = await sendChannelSummaryEmail({
    to,
    subject,
    summary: summary.summary,
    metadata: {
      channelId,
      startDate,
      endDate,
      messageCount: messages.length
    },
    format: format || 'html'
  })

  res.json({
    success: true,
    channelId,
    to,
    startDate,
    endDate,
    messageCount: messages.length,
    emailId: emailResult.id
  })
}))

// Helper function to send summary email
async function sendChannelSummaryEmail({ to, subject, summary, metadata, format }) {
  // For plain text format
  const textContent = `
Discord Channel Summary
======================

Channel ID: ${metadata.channelId}
Date Range: ${metadata.startDate.toLocaleDateString()} to ${metadata.endDate.toLocaleDateString()}
Messages Processed: ${metadata.messageCount}

${summary}

Generated on ${new Date().toLocaleDateString()}
  `.trim()

  // If HTML format is requested
  if (format === 'html') {
    // Process markdown content
    let processedContent = summary
    if (summary.includes('```markdown')) {
      processedContent = summary.replace(/```markdown\n([\s\S]*?)```/g, '$1')
    }
    const htmlContent = renderHtmlSummary(processedContent, metadata)

    return email.sendEmail({
      to,
      subject,
      text: textContent,
      html: htmlContent
    })
  }

  // Otherwise send text-only email
  return email.sendEmail({
    to,
    subject,
    text: textContent
  })
}

// Helper function to render HTML summary
function renderHtmlSummary(markdownContent, metadata) {
  const htmlContent = marked.parse(markdownContent)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Channel Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    header {
      text-align: center;
      margin-bottom: 20px;
    }
    h1 {
      color: #5865F2;
    }
    .metadata {
      background-color: #fff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary {
      background-color: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary img {
      max-width: 100%;
      height: auto;
    }
    footer {
      text-align: center;
      margin-top: 20px;
      font-size: 0.9rem;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <h1>Discord Channel Summary</h1>
  </header>
  <div class="metadata">
    <p><strong>Channel ID:</strong> ${metadata.channelId}</p>
    <p><strong>Date Range:</strong> ${new Date(metadata.startDate).toLocaleDateString()} to ${new Date(metadata.endDate).toLocaleDateString()}</p>
    <p><strong>Messages Processed:</strong> ${metadata.messageCount}</p>
  </div>
  <div class="summary">
    ${htmlContent}
  </div>
  <footer>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </footer>
</body>
</html>`
}

module.exports = router
```

## Step 5: Add Test for Email Summary API

Create a new test file at `test/api/email-summary.test.js`:

```javascript
const test = require('tape')
const request = require('supertest')
const Message = require('../../models/message')
const email = require('../../lib/email')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

// Create a spy for email.sendEmail
const originalSendEmail = email.sendEmail
let emailSent = false
let lastEmailOptions = null

email.sendEmail = async (options) => {
  emailSent = true
  lastEmailOptions = options
  return { id: 'test-email-id', message: 'Test email sent', status: 'success' }
}

// Reset spy before each test
test.onFinish(() => {
  email.sendEmail = originalSendEmail
})

test('POST /email-summary/channel/:channelId - requires to parameter', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ since: '1d' })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Email recipient (to)'))
  t.end()
})

test('POST /email-summary/channel/:channelId - requires since parameter', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ to: 'test@example.com' })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Time period (since)'))
  t.end()
})

test('POST /email-summary/channel/:channelId - validates since format', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ to: 'test@example.com', since: 'invalid' })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Invalid time period format'))
  t.end()
})

test('POST /email-summary/channel/:channelId - returns 404 when no messages found', async t => {
  const response = await request(app)
    .post('/email-summary/channel/nonexistent')
    .send({ to: 'test@example.com', since: '1d' })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 404)
  t.end()
})

test('POST /email-summary/channel/:channelId - sends email summary', async t => {
  // Reset spy state
  emailSent = false
  lastEmailOptions = null
  
  // Create some test messages
  const messages = [
    {
      id: 'email1',
      content: 'test message 1',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel-email',
      guildId: 'guild1',
      createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 60),
      attachments: [],
      embeds: []
    },
    {
      id: 'email2',
      content: 'test message 2',
      authorId: 'user2',
      authorUsername: 'testuser2',
      channelId: 'channel-email',
      guildId: 'guild1',
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 30),
      attachments: [],
      embeds: []
    }
  ]

  await Message.insertMany(messages)

  const response = await request(app)
    .post('/email-summary/channel/channel-email')
    .send({
      to: 'test@example.com',
      since: '2h',
      format: 'html'
    })
    .set('Authorization', 'Bearer test-token')
  
  t.equal(response.status, 200)
  t.equal(response.body.success, true)
  t.equal(response.body.channelId, 'channel-email')
  t.equal(response.body.to, 'test@example.com')
  t.equal(response.body.messageCount, 2)
  t.equal(response.body.emailId, 'test-email-id')
  
  t.ok(emailSent, 'Email was sent')
  t.equal(lastEmailOptions.to, 'test@example.com', 'Email sent to correct recipient')
  t.ok(lastEmailOptions.subject.includes('Discord Channel Summary'), 'Email has correct subject')
  t.ok(lastEmailOptions.html, 'HTML content was included')
  t.ok(lastEmailOptions.text, 'Text content was included')
  
  t.end()
})
```

## Step 6: Update Server.js to Include the New Routes

Update `server.js` to include the new email summary routes:

```javascript
// Add this line with the other requires
const emailSummaryRouter = require('./api/email-summary')

// Add this line where you define the other routes
if (process.env.NODE_ENV === 'test') {
  // In test environment, use mock auth
  const mockAuth = require('./test/helpers/mock-auth')
  app.use('/messages', mockAuth, messagesRouter)
  app.use('/summarize', mockAuth, summarizeRouter)
  app.use('/email-summary', mockAuth, emailSummaryRouter) // Add this line
} else {
  app.use('/messages', messagesRouter)
  app.use('/summarize', summarizeRouter)
  app.use('/email-summary', authMiddleware, emailSummaryRouter) // Add this line with auth
}
```

## Testing the New Functionality

You can test your new email summary API with cURL:

```bash
curl -X POST http://localhost:3000/email-summary/channel/123456789012345678 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "to": "recipient@example.com",
    "since": "24h",
    "format": "html"
  }'
```

## Scheduling Regular Email Summaries

For regular summaries, you could create a cron job or scheduled task that calls this API endpoint. Here's an example of a simple script that could be run daily:

```javascript
// scripts/send-daily-summary.js
const axios = require('axios')
const config = require('../config')

async function sendDailySummary() {
  try {
    // Configuration
    const apiUrl = `http://localhost:${config.port}/email-summary/channel/YOUR_CHANNEL_ID`
    const recipients = ['user1@example.com', 'user2@example.com']
    
    // Get auth token (implement your auth logic here)
    const token = 'your-auth-token'
    
    // Send email to each recipient
    for (const recipient of recipients) {
      await axios.post(
        apiUrl,
        {
          to: recipient,
          since: '24h',
          format: 'html'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )
      console.log(`Daily summary sent to ${recipient}`)
    }
  } catch (error) {
    console.error('Error sending daily summary:', error.response?.data || error.message)
  }
}

if (require.main === module) {
  sendDailySummary()
}

module.exports = sendDailySummary
```

You can run this script with a cron job:

```bash
0 8 * * * node /path/to/your/app/scripts/send-daily-summary.js
```

This would send a daily summary at 8:00 AM every day.

## Conclusion

You've now added email functionality to your Discord newsletter application. This implementation follows the project's patterns by:

1. Creating a modular email service with testing support
2. Reusing the message formatting and summarization logic
3. Following existing patterns for API routes and error handling

The new endpoint allows users to request channel summaries delivered via email for specific time periods, making it easy to stay updated on Discord conversations without having to manually check the application. 