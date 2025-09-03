// EmailDeliveryNode - Sends formatted email using Mailgun

const { Node } = require('brainyflow')
const email = require('../../email')
const { debugLog } = require('../utils')

class EmailDeliveryNode extends Node {
  async prep (memory) {
    const { emailSubject, emailTextContent, emailHtmlContent, emailTo, options } = memory

    if (!emailSubject || !emailTo) {
      throw new Error('EmailDeliveryNode: emailSubject and emailTo are required')
    }

    if (!emailTextContent && !emailHtmlContent) {
      throw new Error('EmailDeliveryNode: emailTextContent or emailHtmlContent is required')
    }

    debugLog(
      `📬 EmailDeliveryNode: Sending email to ${emailTo}...`,
      'email-delivery-start',
      options.debug ? memory.debugSteps : null
    )

    return {
      to: emailTo,
      subject: emailSubject,
      text: emailTextContent,
      html: emailHtmlContent,
      options
    }
  }

  async exec ({ to, subject, text, html, options }) {
    // Prepare email payload
    const emailPayload = {
      to,
      subject,
      text
    }

    // Add HTML if available
    if (html) {
      emailPayload.html = html
    }

    // Send email using the existing email service
    const result = await email.sendEmail(emailPayload)

    return result
  }

  async post (memory, prepResult, execResult) {
    const { options } = memory
    const emailResult = execResult

    // Store email ID in memory
    memory.emailId = emailResult.id || emailResult.messageId || 'sent'

    debugLog(
      `✅ EmailDeliveryNode: Email sent successfully (ID: ${memory.emailId})`,
      'email-delivery-complete',
      options.debug ? memory.debugSteps : null
    )

    // Update metadata
    if (!memory.metadata) {
      memory.metadata = {}
    }
    memory.metadata.emailDelivered = true
    memory.metadata.emailId = memory.emailId
  }
}

module.exports = EmailDeliveryNode
