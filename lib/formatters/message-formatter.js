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
  const username = msg.authorUsername || 'Unknown User'
  const content = msg.content || ''
  let output = `${prefix}[${timestamp}] ${username}: ${content}`

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
  // Add a direct approach for small conversations
  if (messages.length <= 50) {
    let output = ''
    messages.forEach(msg => {
      const timestamp = new Date(msg.createdAt).toISOString().replace('T', ' ').substring(0, 19)
      const username = msg.authorUsername || 'Unknown User'
      const content = msg.content || ''
      output += `[${timestamp}] ${username}: ${content}\n`
      // Add embeds
      if (msg.embeds && msg.embeds.length > 0) {
        msg.embeds.forEach(embed => {
          output += '  [Embed]\n'
          if (embed.title) output += `    Title: ${embed.title}\n`
          if (embed.description) output += `    Description: ${embed.description}\n`
          if (embed.url) output += `    URL: ${embed.url}\n`
        })
      }
      // Add attachments
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach(attachment => {
          output += `  [Attachment: ${attachment.url}]\n`
        })
      }
    })
    return output
  }

  // Original threaded approach for larger conversations
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
