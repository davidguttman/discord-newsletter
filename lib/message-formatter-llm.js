/**
 * LLM-friendly message formatter that flattens reply chains for easier processing
 *
 * Unlike the standard formatter which creates arbitrarily deep reply nesting,
 * this version flattens reply chains so all replies in a conversation become
 * siblings under the original message.
 *
 * Example transformation:
 * Standard: A -> B -> C -> D (nested)
 * LLM:      A -> [B, C, D] (flattened siblings)
 */

/**
 * Finds the root message of a reply chain by following replyToId back to the start
 * @param {String} messageId - Starting message ID
 * @param {Object} messagesById - Object with message IDs as keys
 * @returns {String} ID of the root message in the chain
 */
function findRootOfReplyChain (messageId, messagesById) {
  let currentMsg = messagesById[messageId]

  // Follow the chain back to find the root
  while (currentMsg && currentMsg.replyToId && messagesById[currentMsg.replyToId]) {
    currentMsg = messagesById[currentMsg.replyToId]
  }

  return currentMsg ? currentMsg.id : messageId
}

/**
 * Builds a flattened message structure for LLM processing using simple objects
 * @param {Array} messages - Array of message objects from the database
 * @returns {Object} Object with conversation groups using message IDs as keys
 */
function buildFlattenedMessageMap (messages) {
  // Create lookup object with message IDs as keys
  const messagesById = {}
  messages.forEach(msg => {
    messagesById[msg.id] = { ...msg }
  })

  const conversations = {}
  const processedMessages = new Set()

  messages.forEach(msg => {
    if (processedMessages.has(msg.id)) return

    // Find root of this conversation
    const rootId = msg.replyToId ? findRootOfReplyChain(msg.id, messagesById) : msg.id

    // Initialize conversation if it doesn't exist
    if (!conversations[rootId]) {
      conversations[rootId] = {
        rootMessage: messagesById[rootId],
        replies: {},
        threadMessages: {}
      }
      processedMessages.add(rootId)
    }

    // If this is a reply, add it to the flattened replies
    if (msg.replyToId && msg.id !== rootId) {
      conversations[rootId].replies[msg.id] = messagesById[msg.id]
      processedMessages.add(msg.id)
    }

    // Handle thread messages
    if (msg.threadId && !msg.replyToId) {
      // Find messages in this thread
      const threadMessages = messages.filter(m => m.threadId === msg.threadId)
      threadMessages.forEach(threadMsg => {
        if (!processedMessages.has(threadMsg.id)) {
          conversations[rootId].threadMessages[threadMsg.id] = messagesById[threadMsg.id]
          processedMessages.add(threadMsg.id)
        }
      })
    }
  })

  return conversations
}

/**
 * Formats a single message for text output (same as original)
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
 * Main formatter function with LLM-friendly flattened reply chains
 * @param {Array} messages - Array of message objects from the database
 * @returns {Object} Object with conversation groups using message IDs as keys
 */
function formatMessagesLLM (messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {}
  }

  return buildFlattenedMessageMap(messages)
}

/**
 * Utility function to analyze reply chain structure for debugging
 * @param {Array} messages - Array of message objects
 * @returns {Object} Analysis of reply chain structure
 */
function analyzeReplyChains (messages) {
  const { messageMap, replyChains } = buildFlattenedMessageMap(messages)

  const analysis = {
    totalMessages: messages.length,
    rootMessages: 0,
    repliesTotal: 0,
    longestChain: 0,
    chainStats: []
  }

  replyChains.forEach((replies, rootId) => {
    analysis.rootMessages++
    analysis.repliesTotal += replies.length
    analysis.longestChain = Math.max(analysis.longestChain, replies.length)

    const rootMsg = messageMap.get(rootId)
    analysis.chainStats.push({
      rootId,
      rootAuthor: rootMsg?.authorUsername,
      replyCount: replies.length,
      timeSpan: replies.length > 0
        ? {
            start: rootMsg?.createdAt,
            end: messageMap.get(replies[replies.length - 1])?.createdAt
          }
        : null
    })
  })

  return analysis
}

module.exports = {
  buildFlattenedMessageMap,
  formatMessage,
  formatMessagesLLM,
  analyzeReplyChains,
  findRootOfReplyChain
}
