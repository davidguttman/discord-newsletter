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
