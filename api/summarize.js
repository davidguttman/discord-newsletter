const express = require('express')
const autoCatch = require('../lib/auto-catch')
const Message = require('../models/message')
const messageFormatter = require('../lib/message-formatter')
const openai = require('../lib/openai')
const marked = require('marked')

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
    maxTokens,
    format
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
  const formattedMessages = messageFormatter.formatMessages(messages, { format: 'txt' })

  // Generate summary using OpenAI
  const options = {}
  if (model) options.model = model
  if (maxTokens) options.maxTokens = parseInt(maxTokens)

  const summary = await openai.summarizeMessages(formattedMessages, options)

  // If HTML format is requested, render markdown as HTML
  if (format === 'html') {
    const htmlContent = renderHtmlSummary(summary.summary, {
      channelId,
      startDate,
      endDate,
      messageCount: messages.length
    })
    res.setHeader('Content-Type', 'text/html')
    return res.send(htmlContent)
  }

  if (format === 'txt') {
    res.setHeader('Content-Type', 'text/plain')
    return res.send(summary.summary)
  }

  // Otherwise return JSON response
  res.json({
    channelId,
    startDate,
    endDate,
    messageCount: messages.length,
    summary: summary.summary,
    usage: summary.usage
  })
}))

// Helper function to render HTML summary
function renderHtmlSummary (markdownContent, metadata) {
  // Check if summary contains markdown code blocks and extract the content
  let processedContent = markdownContent
  if (markdownContent.includes('```markdown')) {
    processedContent = markdownContent.replace(/```markdown\n([\s\S]*?)```/g, '$1')
  }

  const htmlContent = marked.parse(processedContent)

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
