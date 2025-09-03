#!/usr/bin/env node

const mongoose = require('../lib/mongo')

async function createMessageMap () {
  try {
    console.log('📊 Creating message map for past 3 days...')
    await mongoose.connection

    // Connect to rich_messages collection
    const richMessageSchema = new mongoose.Schema({}, { strict: false })
    const RichMessage = mongoose.model('RichMessage', richMessageSchema, 'rich_messages')

    // Calculate 3 days ago
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000))

    console.log(`📅 Date range: ${threeDaysAgo.toISOString()} to ${now.toISOString()}`)

    // Fetch messages from past 3 days
    const messages = await RichMessage.find({
      createdAt: {
        $gte: threeDaysAgo,
        $lte: now
      }
    }).sort({ createdAt: 1 })

    console.log(`📝 Found ${messages.length} messages in the past 3 days\n`)

    if (messages.length === 0) {
      console.log('No messages found in the specified date range.')
      return
    }

    // Group messages by day
    const messagesByDay = {}

    messages.forEach(msg => {
      const day = msg.createdAt.toISOString().split('T')[0]
      if (!messagesByDay[day]) {
        messagesByDay[day] = {
          mainChannel: [],
          threads: {}
        }
      }

      if (msg.threadId) {
        // Thread message
        if (!messagesByDay[day].threads[msg.threadId]) {
          messagesByDay[day].threads[msg.threadId] = {
            name: extractThreadName(msg),
            messages: []
          }
        }
        messagesByDay[day].threads[msg.threadId].messages.push(msg)
      } else {
        // Main channel message
        messagesByDay[day].mainChannel.push(msg)
      }
    })

    // Display the message map
    const sortedDays = Object.keys(messagesByDay).sort()

    for (const day of sortedDays) {
      const dayData = messagesByDay[day]
      const totalForDay = dayData.mainChannel.length +
        Object.values(dayData.threads).reduce((sum, thread) => sum + thread.messages.length, 0)

      console.log(`\n📅 ${day} (${totalForDay} messages)`)
      console.log('═'.repeat(60))

      // Main channel messages
      if (dayData.mainChannel.length > 0) {
        console.log(`\n📝 Main Channel (${dayData.mainChannel.length} messages):`)
        dayData.mainChannel.forEach(msg => {
          const time = formatTime(msg.createdAt)
          const preview = truncateContent(msg.content)
          const author = msg.authorUsername

          console.log(`  [${time}] ${author}: ${preview}`)

          if (msg.replyToId) {
            console.log(`    ↳ Reply to: ${msg.replyToId}`)
          }

          if (msg.attachments && msg.attachments.length > 0) {
            console.log(`    📎 ${msg.attachments.length} attachment(s)`)
          }
        })
      }

      // Thread messages
      const threadIds = Object.keys(dayData.threads)
      if (threadIds.length > 0) {
        console.log(`\n🧵 Threads (${threadIds.length} active):`)

        threadIds.forEach(threadId => {
          const thread = dayData.threads[threadId]
          console.log(`\n  "${thread.name}" (${thread.messages.length} messages):`)

          thread.messages.forEach(msg => {
            const time = formatTime(msg.createdAt)
            const preview = truncateContent(msg.content)
            const author = msg.authorUsername

            console.log(`    [${time}] ${author}: ${preview}`)

            if (msg.replyToId) {
              console.log(`      ↳ Reply to: ${msg.replyToId}`)
            }
          })
        })
      }
    }

    // Summary statistics
    console.log('\n\n📊 Summary Statistics:')
    console.log('═'.repeat(40))

    const totalMessages = messages.length
    const mainChannelMessages = messages.filter(m => !m.threadId).length
    const threadMessages = messages.filter(m => m.threadId).length
    const uniqueThreads = new Set(messages.filter(m => m.threadId).map(m => m.threadId)).size
    const uniqueAuthors = new Set(messages.map(m => m.authorUsername)).size
    const messagesWithReplies = messages.filter(m => m.replyToId).length
    const messagesWithAttachments = messages.filter(m => m.attachments && m.attachments.length > 0).length

    console.log(`Total Messages: ${totalMessages}`)
    console.log(`Main Channel: ${mainChannelMessages}`)
    console.log(`Thread Messages: ${threadMessages}`)
    console.log(`Active Threads: ${uniqueThreads}`)
    console.log(`Unique Authors: ${uniqueAuthors}`)
    console.log(`Reply Messages: ${messagesWithReplies}`)
    console.log(`Messages with Attachments: ${messagesWithAttachments}`)

    // Top active threads
    if (uniqueThreads > 0) {
      console.log('\n🔥 Most Active Threads:')
      const threadActivity = {}
      messages.filter(m => m.threadId).forEach(msg => {
        const threadName = extractThreadName(msg)
        threadActivity[threadName] = (threadActivity[threadName] || 0) + 1
      })

      const sortedThreads = Object.entries(threadActivity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      sortedThreads.forEach(([name, count], index) => {
        console.log(`${index + 1}. "${name}" (${count} messages)`)
      })
    }

    // Top active authors
    console.log('\n👥 Most Active Authors:')
    const authorActivity = {}
    messages.forEach(msg => {
      authorActivity[msg.authorUsername] = (authorActivity[msg.authorUsername] || 0) + 1
    })

    const sortedAuthors = Object.entries(authorActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    sortedAuthors.forEach(([author, count], index) => {
      console.log(`${index + 1}. ${author} (${count} messages)`)
    })
  } catch (error) {
    console.error('❌ Error creating message map:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

function extractThreadName (msg) {
  // Try to get thread name from various sources
  if (msg.rawDiscordData && msg.rawDiscordData.channel && msg.rawDiscordData.channel.name) {
    return msg.rawDiscordData.channel.name
  }
  return `Thread ${msg.threadId.slice(-8)}` // Fallback to partial ID
}

function formatTime (date) {
  return date.toTimeString().split(' ')[0].slice(0, 5) // HH:MM format
}

function truncateContent (content) {
  if (!content) return '[empty]'
  const cleaned = content.replace(/\n/g, ' ').trim()
  return cleaned.length > 60 ? cleaned.slice(0, 57) + '...' : cleaned
}

if (require.main === module) {
  createMessageMap()
}

module.exports = createMessageMap
