const https = require('https')

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

function printThreadedMessages (messageMap, threadMap, rootMessages) {
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

async function main () {
  try {
    const response = await fetchMessages()
    const messages = response.messages
    const { messageMap, threadMap, rootMessages } = buildMessageMap(messages)
    const output = printThreadedMessages(messageMap, threadMap, rootMessages)
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
  fetchMessages,
  buildMessageMap,
  printThreadedMessages
}
