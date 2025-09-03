#!/usr/bin/env node

const mongoose = require('../lib/mongo')

async function createConversationMap () {
  try {
    console.log('🗺️  Creating conversation map for past 3 days...')
    await mongoose.connection

    const richMessageSchema = new mongoose.Schema({}, { strict: false })
    const RichMessage = mongoose.model('RichMessage', richMessageSchema, 'rich_messages')

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000))

    const messages = await RichMessage.find({
      createdAt: { $gte: threeDaysAgo, $lte: now }
    }).sort({ createdAt: 1 })

    console.log(`📝 Found ${messages.length} messages\n`)

    // Build conversation threads and reply chains
    const conversations = new Map()
    const messageIndex = new Map()

    // Index all messages
    messages.forEach(msg => {
      messageIndex.set(msg.id, msg)
    })

    // Build conversation trees
    messages.forEach(msg => {
      if (msg.threadId) {
        // Thread conversation
        if (!conversations.has(msg.threadId)) {
          conversations.set(msg.threadId, {
            type: 'thread',
            name: extractThreadName(msg),
            starter: null,
            messages: [],
            replyChains: new Map()
          })
        }
        conversations.get(msg.threadId).messages.push(msg)
      } else if (msg.replyToId) {
        // Reply chain in main channel
        const rootMsg = findConversationRoot(msg, messageIndex)
        const rootId = rootMsg ? rootMsg.id : msg.replyToId

        if (!conversations.has(rootId)) {
          conversations.set(rootId, {
            type: 'reply_chain',
            starter: rootMsg,
            messages: rootMsg ? [rootMsg] : [],
            replyChains: new Map()
          })
        }
        conversations.get(rootId).messages.push(msg)
      } else {
        // Standalone message - check if it becomes a conversation starter later
        const hasReplies = messages.some(m => m.replyToId === msg.id)
        if (hasReplies) {
          conversations.set(msg.id, {
            type: 'reply_chain',
            starter: msg,
            messages: [msg],
            replyChains: new Map()
          })
        }
      }
    })

    // Build reply trees within conversations
    conversations.forEach(conv => {
      if (conv.type === 'reply_chain') {
        conv.replyTree = buildReplyTree(conv.messages)
      }
    })

    // Display conversation map
    console.log('🗺️  CONVERSATION MAP')
    console.log('═'.repeat(80))

    let convCount = 0
    const sortedConversations = Array.from(conversations.entries())
      .sort(([, a], [, b]) => {
        const aTime = a.messages[0]?.createdAt || new Date(0)
        const bTime = b.messages[0]?.createdAt || new Date(0)
        return aTime - bTime
      })

    for (const [id, conv] of sortedConversations) {
      if (conv.messages.length <= 1) continue // Skip single messages

      convCount++
      const day = conv.messages[0].createdAt.toISOString().split('T')[0]

      console.log(`\n${convCount}. ${conv.type === 'thread' ? '🧵' : '💬'} ${conv.type.toUpperCase()}: ${conv.name || 'Reply Chain'} (${conv.messages.length} messages)`)
      console.log(`📅 ${day} | Started: ${formatTime(conv.messages[0].createdAt)} | Ended: ${formatTime(conv.messages[conv.messages.length - 1].createdAt)}`)

      if (conv.type === 'thread') {
        displayThreadConversation(conv)
      } else {
        displayReplyChain(conv)
      }
    }

    // Standalone messages (no replies)
    const standaloneMessages = messages.filter(msg =>
      !msg.threadId &&
      !msg.replyToId &&
      !messages.some(m => m.replyToId === msg.id)
    )

    if (standaloneMessages.length > 0) {
      console.log(`\n📝 STANDALONE MESSAGES (${standaloneMessages.length})`)
      console.log('─'.repeat(60))

      standaloneMessages.slice(0, 10).forEach(msg => {
        const day = msg.createdAt.toISOString().split('T')[0]
        const time = formatTime(msg.createdAt)
        const preview = truncateContent(msg.content, 80)
        console.log(`[${day} ${time}] ${msg.authorUsername}: ${preview}`)
      })

      if (standaloneMessages.length > 10) {
        console.log(`... and ${standaloneMessages.length - 10} more`)
      }
    }

    // Summary
    console.log('\n📊 CONVERSATION SUMMARY')
    console.log('═'.repeat(40))
    console.log(`Total Conversations: ${convCount}`)
    console.log(`Thread Conversations: ${Array.from(conversations.values()).filter(c => c.type === 'thread').length}`)
    console.log(`Reply Chain Conversations: ${Array.from(conversations.values()).filter(c => c.type === 'reply_chain').length}`)
    console.log(`Standalone Messages: ${standaloneMessages.length}`)
    console.log(`Avg Messages per Conversation: ${Math.round(Array.from(conversations.values()).reduce((sum, c) => sum + c.messages.length, 0) / convCount)}`)
  } catch (error) {
    console.error('❌ Error creating conversation map:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

function findConversationRoot (msg, messageIndex) {
  let current = msg
  while (current.replyToId) {
    const parent = messageIndex.get(current.replyToId)
    if (!parent) break
    current = parent
  }
  return current !== msg ? current : null
}

function buildReplyTree (messages) {
  const tree = new Map()
  const roots = []

  messages.forEach(msg => {
    if (!msg.replyToId) {
      roots.push(msg)
      tree.set(msg.id, { message: msg, replies: [] })
    }
  })

  messages.forEach(msg => {
    if (msg.replyToId) {
      if (!tree.has(msg.id)) {
        tree.set(msg.id, { message: msg, replies: [] })
      }

      if (tree.has(msg.replyToId)) {
        tree.get(msg.replyToId).replies.push(tree.get(msg.id))
      }
    }
  })

  return { roots: roots.map(r => tree.get(r.id)), tree }
}

function displayThreadConversation (conv) {
  const participants = [...new Set(conv.messages.map(m => m.authorUsername))]
  console.log(`👥 Participants: ${participants.join(', ')}`)

  conv.messages.slice(0, 8).forEach((msg, i) => {
    const time = formatTime(msg.createdAt)
    const preview = truncateContent(msg.content, 60)
    const indent = i === 0 ? '├─' : '│ '
    console.log(`${indent} [${time}] ${msg.authorUsername}: ${preview}`)
  })

  if (conv.messages.length > 8) {
    console.log(`│ ... and ${conv.messages.length - 8} more messages`)
  }
}

function displayReplyChain (conv) {
  if (!conv.replyTree) return

  const participants = [...new Set(conv.messages.map(m => m.authorUsername))]
  console.log(`👥 Participants: ${participants.join(', ')}`)

  function displayNode (node, depth = 0, isLast = true) {
    const indent = '  '.repeat(depth) + (depth === 0 ? '├─' : (isLast ? '└─' : '├─'))
    const time = formatTime(node.message.createdAt)
    const preview = truncateContent(node.message.content, 50)
    console.log(`${indent} [${time}] ${node.message.authorUsername}: ${preview}`)

    node.replies.forEach((reply, i) => {
      displayNode(reply, depth + 1, i === node.replies.length - 1)
    })
  }

  conv.replyTree.roots.slice(0, 3).forEach(root => {
    displayNode(root)
  })

  if (conv.replyTree.roots.length > 3) {
    console.log(`  ... and ${conv.replyTree.roots.length - 3} more reply trees`)
  }
}

function extractThreadName (msg) {
  if (msg.rawDiscordData?.channel?.name) {
    return msg.rawDiscordData.channel.name
  }
  return `Thread ${msg.threadId.slice(-8)}`
}

function formatTime (date) {
  return date.toTimeString().split(' ')[0].slice(0, 5)
}

function truncateContent (content, maxLen = 60) {
  if (!content) return '[empty]'
  const cleaned = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen - 3) + '...' : cleaned
}

if (require.main === module) {
  createConversationMap()
}

module.exports = createConversationMap
