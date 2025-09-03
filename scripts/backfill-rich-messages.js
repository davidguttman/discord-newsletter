#!/usr/bin/env node

const config = require('../config')
const discord = require('../lib/discord')
const mongoose = require('../lib/mongo')
const fs = require('fs')

async function backfillRichMessages () {
  try {
    console.log('🌱 Starting rich messages backfill...')
    await mongoose.connection

    // Create the RichMessage model
    const richMessageSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      content: { type: String, required: false, default: '' },
      authorId: { type: String, required: true },
      authorUsername: { type: String, required: true },
      channelId: { type: String, required: true },
      channelName: { type: String, required: true },
      guildId: { type: String },
      guildName: { type: String },
      threadId: { type: String, default: null },
      parentId: { type: String },
      createdAt: { type: Date, required: true },
      updatedAt: { type: Date, required: true },
      replyToId: { type: String, default: null },
      mentionsReplyTarget: { type: Boolean, default: false },
      attachments: [{ id: String, url: String, name: String, size: Number }],
      embeds: [{ type: { type: String, required: true }, title: String, description: String, url: String }],
      messageType: String,
      system: Boolean,
      pinned: Boolean,
      tts: Boolean,
      flags: Number,
      position: Number,
      cleanContent: String,
      mentions: {
        everyone: Boolean,
        users: [String],
        roles: [String],
        repliedUser: String,
        channels: [String]
      },
      reference: mongoose.Schema.Types.Mixed,
      channelType: String,
      isThread: Boolean,
      createdTimestamp: Number,
      editedTimestamp: Number,
      webhookId: String,
      applicationId: String,
      nonce: String,
      rawDiscordData: mongoose.Schema.Types.Mixed
    }, { timestamps: false })

    const RichMessage = mongoose.model('RichMessage', richMessageSchema, 'rich_messages')

    const channelId = '1209303473263485011'

    // Calculate 1 month ago
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))

    console.log(`📅 Backfilling messages from last 30 days: ${oneMonthAgo.toISOString()} to ${now.toISOString()}`)

    console.log('\n🤖 Starting Discord client...')
    await discord.start()

    const client = discord.getClient()
    console.log(`✅ Discord client ready as ${client.user.tag}`)

    let targetChannel = null
    let targetGuild = null

    // Find the channel
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(channelId)
      if (channel) {
        targetChannel = channel
        targetGuild = guild
        break
      }
    }

    if (!targetChannel) {
      console.error(`❌ Channel ${channelId} not found`)
      process.exit(1)
    }

    console.log(`✅ Found channel: #${targetChannel.name}`)

    const allMessages = []

    // Rate limiting delay
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    // Function to fetch messages from a single channel
    async function fetchMessagesFromChannel (channel, channelName) {
      console.log(`\n📥 Fetching messages from ${channelName}...`)
      let channelMessages = []
      let lastMessageId = null
      let hasMore = true
      let batchCount = 0

      while (hasMore) {
        const fetchOptions = { limit: 100 }
        if (lastMessageId) {
          fetchOptions.before = lastMessageId
        }

        batchCount++
        console.log(`    📦 Fetching batch ${batchCount} from ${channelName}...`)

        const messages = await channel.messages.fetch(fetchOptions)

        if (messages.size === 0) {
          console.log(`    ✅ No more messages found in ${channelName}`)
          hasMore = false
          break
        }

        // Filter messages within our time range
        const relevantMessages = messages.filter(msg => {
          const msgDate = new Date(msg.createdTimestamp)
          return msgDate >= oneMonthAgo
        })

        const newMessages = Array.from(relevantMessages.values())
        channelMessages = channelMessages.concat(newMessages)

        console.log(`    📝 Found ${newMessages.length} messages in date range (${messages.size} total in batch)`)

        // Check if we've gone past our start date
        const oldestMessage = messages.last()
        if (oldestMessage && new Date(oldestMessage.createdTimestamp) < oneMonthAgo) {
          console.log(`    ✅ Reached messages older than 30 days in ${channelName}`)
          hasMore = false
        } else if (messages.size < 100) {
          console.log(`    ✅ Reached end of ${channelName} history`)
          hasMore = false
        } else {
          lastMessageId = oldestMessage.id
        }

        // Rate limit between batch requests
        await sleep(500)
      }

      return channelMessages
    }

    // 1. FETCH MAIN CHANNEL MESSAGES
    const mainChannelMessages = await fetchMessagesFromChannel(targetChannel, `main channel #${targetChannel.name}`)
    allMessages.push(...mainChannelMessages)

    // 2. FETCH ALL THREADS AND THEIR MESSAGES
    console.log('\n🧵 Fetching all threads...')
    const activeThreads = await targetChannel.threads.fetchActive()
    const archivedThreads = await targetChannel.threads.fetchArchived()

    const allThreads = new Map([...activeThreads.threads, ...archivedThreads.threads])
    console.log(`📝 Found ${allThreads.size} total threads`)

    for (const [threadId, threadChannel] of allThreads) {
      try {
        const threadMessages = await fetchMessagesFromChannel(threadChannel, `thread "${threadChannel.name}"`)
        allMessages.push(...threadMessages)

        // Rate limit between threads
        await sleep(1000)
      } catch (error) {
        console.error(`    ❌ Error fetching from thread "${threadChannel.name}":`, error.message)
      }
    }

    console.log(`\n📊 Found ${allMessages.length} total messages to process`)

    if (allMessages.length === 0) {
      console.log('✅ No messages to process')
      return
    }

    // Process and save messages to rich_messages collection
    console.log('\n💾 Saving messages to rich_messages collection...')
    let savedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const discordMsg of allMessages) {
      try {
        // Check if message already exists
        const existingMessage = await RichMessage.findOne({ id: discordMsg.id })

        if (existingMessage) {
          skippedCount++
          continue
        }

        // Determine if this is a thread message
        const isInThread = discordMsg.channel.type === 10 || discordMsg.channel.type === 11 || discordMsg.channel.type === 12
        const actualChannelId = isInThread ? discordMsg.channel.parentId : discordMsg.channel.id
        const actualChannelName = isInThread ? targetChannel.name : discordMsg.channel.name

        // Create rich message document with complete Discord data
        const richMessageDoc = new RichMessage({
          // Basic fields
          id: discordMsg.id,
          content: discordMsg.content || '',
          authorId: discordMsg.author.id,
          authorUsername: discordMsg.author.username,
          channelId: actualChannelId,
          channelName: actualChannelName,
          guildId: targetGuild.id,
          guildName: targetGuild.name,
          createdAt: new Date(discordMsg.createdTimestamp),
          updatedAt: discordMsg.editedTimestamp ? new Date(discordMsg.editedTimestamp) : new Date(discordMsg.createdTimestamp),
          attachments: discordMsg.attachments.map(att => ({
            id: att.id,
            name: att.name,
            url: att.url,
            size: att.size
          })),
          embeds: discordMsg.embeds.map(embed => ({
            type: embed.type || 'rich',
            title: embed.title,
            description: embed.description,
            url: embed.url
          })),

          // Thread and reply support
          threadId: isInThread ? discordMsg.channel.id : (discordMsg.thread?.id || null),
          parentId: isInThread ? discordMsg.channel.parentId : (discordMsg.channel?.parent?.id || null),
          replyToId: discordMsg.reference?.messageId || null,
          mentionsReplyTarget: !!discordMsg.reference,

          // Rich Discord data
          messageType: discordMsg.type,
          system: discordMsg.system,
          pinned: discordMsg.pinned,
          tts: discordMsg.tts,
          flags: discordMsg.flags,
          position: discordMsg.position,
          cleanContent: discordMsg.cleanContent,

          // Complete mention data
          mentions: {
            everyone: discordMsg.mentions.everyone,
            users: Array.from(discordMsg.mentions.users.keys()),
            roles: Array.from(discordMsg.mentions.roles.keys()),
            repliedUser: discordMsg.mentions.repliedUser?.id || null,
            channels: Array.from(discordMsg.mentions.channels.keys())
          },

          // Complete reference data
          reference: discordMsg.reference
            ? {
                messageId: discordMsg.reference.messageId,
                channelId: discordMsg.reference.channelId,
                guildId: discordMsg.reference.guildId,
                type: discordMsg.reference.type
              }
            : null,

          // Channel metadata
          channelType: discordMsg.channel.type,
          isThread: isInThread,

          // Raw Discord timestamps
          createdTimestamp: discordMsg.createdTimestamp,
          editedTimestamp: discordMsg.editedTimestamp,

          // Additional Discord fields
          webhookId: discordMsg.webhookId,
          applicationId: discordMsg.applicationId,
          nonce: discordMsg.nonce,

          // Store complete raw Discord data for future-proofing
          rawDiscordData: discordMsg.toJSON()
        })

        await richMessageDoc.save()
        savedCount++

        if (savedCount % 100 === 0) {
          console.log(`    📝 Saved ${savedCount} messages so far...`)
        }
      } catch (saveError) {
        console.error(`    ❌ Error saving message ${discordMsg.id}:`, saveError.message)
        errorCount++
      }
    }

    console.log('\n📊 Rich Messages Backfill Summary:')
    console.log(`- Channel: #${targetChannel.name} (${channelId})`)
    console.log(`- Guild: ${targetGuild.name} (${targetGuild.id})`)
    console.log(`- Date range: ${oneMonthAgo.toISOString()} to ${now.toISOString()}`)
    console.log(`- Messages found: ${allMessages.length}`)
    console.log(`- Messages saved: ${savedCount}`)
    console.log(`- Messages skipped (already exist): ${skippedCount}`)
    console.log(`- Errors: ${errorCount}`)
    console.log('✅ Rich messages backfill completed')

    // Count thread vs main channel messages
    const threadMessageCount = await RichMessage.countDocuments({ threadId: { $ne: null } })
    const mainChannelMessageCount = await RichMessage.countDocuments({ threadId: null })

    console.log('\n📈 Collection Statistics:')
    console.log(`- Total messages in rich_messages: ${savedCount}`)
    console.log(`- Main channel messages: ${mainChannelMessageCount}`)
    console.log(`- Thread messages: ${threadMessageCount}`)
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error)
    process.exit(1)
  } finally {
    try {
      await discord.stop()
    } catch (stopError) {
      console.error('Error stopping Discord client:', stopError)
    }
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  backfillRichMessages()
}

module.exports = backfillRichMessages
