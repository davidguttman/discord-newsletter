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
    if (!duration) {
      return res.status(400).json({ error: 'Invalid time period format. Use values like "24h", "1d", "7d", etc.' })
    }
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
async function sendChannelSummaryEmail ({ to, subject, summary, metadata, format }) {
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
function renderHtmlSummary (markdownContent, metadata) {
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
