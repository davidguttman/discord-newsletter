// EmailFormatterNode - Formats newsletter content for email delivery

const { Node } = require('brainyflow')
const marked = require('marked')
const { debugLog } = require('../utils')

class EmailFormatterNode extends Node {
  async prep (memory) {
    const { summary, startDate, endDate, emailOptions, options } = memory

    if (!summary) {
      throw new Error('EmailFormatterNode: summary is required')
    }

    if (!emailOptions || !emailOptions.to) {
      throw new Error('EmailFormatterNode: emailOptions.to is required')
    }

    debugLog(
      '📧 EmailFormatterNode: Formatting content for email...',
      'email-format-start',
      options.debug ? memory.debugSteps : null
    )

    return { summary, startDate, endDate, emailOptions, options }
  }

  async exec ({ summary, startDate, endDate, emailOptions, options }) {
    // Generate email subject
    const startDateStr = startDate.toLocaleDateString()
    const endDateStr = endDate.toLocaleDateString()
    const subject = emailOptions.subject || `Discord Channel Summary (${startDateStr} to ${endDateStr})`

    // Generate plain text content
    const textContent = this.generateTextContent(summary, {
      channelId: 'channel',
      startDate,
      endDate,
      messageCount: 0
    })

    // Generate HTML content if requested
    let htmlContent = null
    if (emailOptions.format === 'html' || !emailOptions.format) {
      htmlContent = this.generateHtmlContent(summary, {
        channelId: 'channel',
        startDate,
        endDate,
        messageCount: 0
      })
    }

    return {
      subject,
      textContent,
      htmlContent,
      to: emailOptions.to
    }
  }

  async post (memory, prepResult, execResult) {
    const { subject, textContent, htmlContent, to } = execResult
    const { options } = memory

    // Store email content in memory
    memory.emailSubject = subject
    memory.emailContent = htmlContent || textContent
    memory.emailTextContent = textContent
    memory.emailHtmlContent = htmlContent
    memory.emailTo = to

    debugLog(
      `📧 EmailFormatterNode: Email content formatted for ${to}`,
      'email-format-complete',
      options.debug ? memory.debugSteps : null
    )
  }

  generateTextContent (summary, metadata) {
    return `
Discord Channel Summary
======================

Channel ID: ${metadata.channelId}
Date Range: ${metadata.startDate.toLocaleDateString()} to ${metadata.endDate.toLocaleDateString()}
Messages Processed: ${metadata.messageCount}

${summary}

Generated on ${new Date().toLocaleDateString()}
    `.trim()
  }

  generateHtmlContent (summary, metadata) {
    // Process markdown content
    let processedContent = summary
    if (summary.includes('```markdown')) {
      processedContent = summary.replace(/```markdown\n([\\s\\S]*?)```/g, '$1')
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
}

module.exports = EmailFormatterNode
