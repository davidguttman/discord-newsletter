#!/usr/bin/env node

const mongoose = require('../lib/mongo')
const fs = require('fs')

async function createMessageMapObject () {
  try {
    console.log('🗺️  Creating message map object for past 3 days...')
    await mongoose.connection

    const richMessageSchema = new mongoose.Schema({}, { strict: false })
    const RichMessage = mongoose.model('RichMessage', richMessageSchema, 'rich_messages')

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000))

    const messages = await RichMessage.find({
      createdAt: { $gte: threeDaysAgo, $lte: now }
    }).sort({ createdAt: 1 })

    console.log(`📝 Found ${messages.length} messages`)

    // Build the structured message map object
    const messageMap = {
      metadata: {
        dateRange: {
          start: threeDaysAgo.toISOString(),
          end: now.toISOString(),
          daysBack: 3
        },
        totalMessages: messages.length,
        generatedAt: new Date().toISOString()
      },
      conversations: [],
      threads: [],
      replyChains: [],
      standaloneMessages: [],
      statistics: {}
    }

    // Index all messages
    const messageIndex = new Map()
    messages.forEach(msg => {
      messageIndex.set(msg.id, msg.toObject())
    })

    // Separate into categories
    const processedMessageIds = new Set()

    // 1. THREADS
    const threadGroups = new Map()
    messages.forEach(msg => {
      if (msg.threadId) {
        if (!threadGroups.has(msg.threadId)) {
          threadGroups.set(msg.threadId, {
            threadId: msg.threadId,
            threadName: extractThreadName(msg),
            channelId: msg.channelId,
            channelName: msg.channelName,
            messages: [],
            participants: new Set(),
            startTime: null,
            endTime: null,
            messageCount: 0
          })
        }

        const thread = threadGroups.get(msg.threadId)
        const msgObj = msg.toObject()
        thread.messages.push(msgObj)
        thread.participants.add(msg.authorUsername)
        thread.messageCount++

        if (!thread.startTime || msg.createdAt < thread.startTime) {
          thread.startTime = msg.createdAt
        }
        if (!thread.endTime || msg.createdAt > thread.endTime) {
          thread.endTime = msg.createdAt
        }

        processedMessageIds.add(msg.id)
      }
    })

    // Convert thread participants to arrays and add to messageMap
    threadGroups.forEach(thread => {
      thread.participants = Array.from(thread.participants)
      messageMap.threads.push(thread)
    })

    // 2. REPLY CHAINS (main channel)
    const replyChainGroups = new Map()

    messages.forEach(msg => {
      if (!msg.threadId && msg.replyToId && !processedMessageIds.has(msg.id)) {
        // Find root of reply chain
        let rootMsg = msg
        let currentMsg = msg
        const chainMessages = [msg.toObject()]

        // Walk up the reply chain
        while (currentMsg.replyToId) {
          const parentMsg = messageIndex.get(currentMsg.replyToId)
          if (!parentMsg || parentMsg.threadId) break

          chainMessages.unshift(parentMsg)
          rootMsg = parentMsg
          currentMsg = parentMsg
        }

        const rootId = rootMsg.id

        if (!replyChainGroups.has(rootId)) {
          replyChainGroups.set(rootId, {
            rootMessageId: rootId,
            rootMessage: rootMsg,
            messages: [],
            participants: new Set(),
            startTime: rootMsg.createdAt,
            endTime: rootMsg.createdAt,
            messageCount: 0,
            replyTree: null
          })
        }

        const chain = replyChainGroups.get(rootId)
        chainMessages.forEach(msgObj => {
          if (!chain.messages.find(m => m.id === msgObj.id)) {
            chain.messages.push(msgObj)
            chain.participants.add(msgObj.authorUsername)
            chain.messageCount++

            if (msgObj.createdAt > chain.endTime) {
              chain.endTime = msgObj.createdAt
            }

            processedMessageIds.add(msgObj.id)
          }
        })
      }
    })

    // Add root messages that have replies
    messages.forEach(msg => {
      if (!msg.threadId && !msg.replyToId) {
        const hasReplies = messages.some(m => m.replyToId === msg.id && !m.threadId)
        if (hasReplies && !processedMessageIds.has(msg.id)) {
          const rootId = msg.id

          if (!replyChainGroups.has(rootId)) {
            replyChainGroups.set(rootId, {
              rootMessageId: rootId,
              rootMessage: msg.toObject(),
              messages: [msg.toObject()],
              participants: new Set([msg.authorUsername]),
              startTime: msg.createdAt,
              endTime: msg.createdAt,
              messageCount: 1,
              replyTree: null
            })
          }

          processedMessageIds.add(msg.id)
        }
      }
    })

    // Convert reply chain participants to arrays and build reply trees
    replyChainGroups.forEach(chain => {
      chain.participants = Array.from(chain.participants)
      chain.replyTree = buildReplyTree(chain.messages)
      messageMap.replyChains.push(chain)
    })

    // 3. STANDALONE MESSAGES
    messages.forEach(msg => {
      if (!processedMessageIds.has(msg.id)) {
        messageMap.standaloneMessages.push(msg.toObject())
      }
    })

    // 4. STATISTICS
    messageMap.statistics = {
      totalMessages: messages.length,
      threadMessages: messageMap.threads.reduce((sum, t) => sum + t.messageCount, 0),
      replyChainMessages: messageMap.replyChains.reduce((sum, c) => sum + c.messageCount, 0),
      standaloneMessages: messageMap.standaloneMessages.length,
      threadCount: messageMap.threads.length,
      replyChainCount: messageMap.replyChains.length,
      uniqueAuthors: [...new Set(messages.map(m => m.authorUsername))].length,
      messagesWithAttachments: messages.filter(m => m.attachments && m.attachments.length > 0).length,
      averageMessagesPerConversation: Math.round(
        (messageMap.threads.length + messageMap.replyChains.length) > 0
          ? (messageMap.threads.reduce((sum, t) => sum + t.messageCount, 0) +
             messageMap.replyChains.reduce((sum, c) => sum + c.messageCount, 0)) /
            (messageMap.threads.length + messageMap.replyChains.length)
          : 0
      ),
      topAuthors: getTopAuthors(messages, 10),
      dailyBreakdown: getDailyBreakdown(messages)
    }

    // 5. COMBINED CONVERSATIONS (for easier processing)
    messageMap.conversations = [
      ...messageMap.threads.map(t => ({ type: 'thread', ...t })),
      ...messageMap.replyChains.map(c => ({ type: 'reply_chain', ...c }))
    ].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

    // Save to file
    const filename = `message-map-${now.toISOString().split('T')[0]}.json`
    fs.writeFileSync(filename, JSON.stringify(messageMap, null, 2))

    console.log(`✅ Message map object saved to: ${filename}`)
    console.log(`📊 Summary: ${messageMap.statistics.totalMessages} messages, ${messageMap.conversations.length} conversations`)

    return messageMap
  } catch (error) {
    console.error('❌ Error creating message map object:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

function buildReplyTree (messages) {
  const messageMap = new Map()
  const roots = []

  // Index messages
  messages.forEach(msg => {
    messageMap.set(msg.id, { message: msg, replies: [] })
  })

  // Build tree structure
  messages.forEach(msg => {
    if (!msg.replyToId) {
      roots.push(messageMap.get(msg.id))
    } else if (messageMap.has(msg.replyToId)) {
      messageMap.get(msg.replyToId).replies.push(messageMap.get(msg.id))
    }
  })

  return { roots, messageMap: Object.fromEntries(messageMap) }
}

function extractThreadName (msg) {
  if (msg.rawDiscordData?.channel?.name) {
    return msg.rawDiscordData.channel.name
  }
  return `Thread ${msg.threadId.slice(-8)}`
}

function getTopAuthors (messages, limit = 10) {
  const authorCounts = {}
  messages.forEach(msg => {
    authorCounts[msg.authorUsername] = (authorCounts[msg.authorUsername] || 0) + 1
  })

  return Object.entries(authorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([author, count]) => ({ author, messageCount: count }))
}

function getDailyBreakdown (messages) {
  const dailyStats = {}

  messages.forEach(msg => {
    const day = msg.createdAt.toISOString().split('T')[0]
    if (!dailyStats[day]) {
      dailyStats[day] = {
        date: day,
        totalMessages: 0,
        threadMessages: 0,
        mainChannelMessages: 0,
        uniqueAuthors: new Set()
      }
    }

    dailyStats[day].totalMessages++
    dailyStats[day].uniqueAuthors.add(msg.authorUsername)

    if (msg.threadId) {
      dailyStats[day].threadMessages++
    } else {
      dailyStats[day].mainChannelMessages++
    }
  })

  // Convert Sets to counts
  Object.values(dailyStats).forEach(day => {
    day.uniqueAuthors = day.uniqueAuthors.size
  })

  return dailyStats
}

if (require.main === module) {
  createMessageMapObject()
}

module.exports = createMessageMapObject
