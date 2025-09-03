#!/usr/bin/env node

const config = require('../config')
const mongoose = require('../lib/mongo')
const discord = require('../lib/discord')
const Message = require('../models/message')

// Rate limiting delay between requests (in milliseconds)
const DELAY_BETWEEN_REQUESTS = 1000 // 1 second

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseArgs () {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.log('Usage: node seed-channel-range.js <channelId> <startDate> <endDate>')
    console.log('  channelId: Discord channel ID (e.g., 1209303473263485011)')
    console.log('  startDate: Start date (YYYY-MM-DD or ISO string)')
    console.log('  endDate: End date (YYYY-MM-DD or ISO string)')
    console.log('')
    console.log('Example: node seed-channel-range.js 1209303473263485011 2025-07-20 2025-07-23')
    process.exit(1)
  }

  const [channelId, startDateStr, endDateStr] = args

  // Parse dates
  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD or ISO date strings.')
    process.exit(1)
  }

  if (startDate >= endDate) {
    console.error('❌ Start date must be before end date.')
    process.exit(1)
  }

  return { channelId, startDate, endDate }
}

async function seedChannelRange () {
  const { channelId, startDate, endDate } = parseArgs()

  try {
    console.log('🌱 Starting channel range seeding process...')
    console.log(`📍 Channel ID: ${channelId}`)
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Start Discord client
    console.log('\n🤖 Starting Discord client...')
    await discord.start()

    // Get Discord client
    const client = discord.getClient()
    console.log(`✅ Discord client ready as ${client.user.tag}`)

    // Find channel across all guilds
    let targetChannel = null
    let targetGuild = null

    console.log('\n🔍 Searching for channel across all guilds...')
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.get(channelId)
      if (channel) {
        targetChannel = channel
        targetGuild = guild
        break
      }
    }

    if (!targetChannel) {
      console.error(`❌ Channel ${channelId} not found in any accessible guilds`)
      process.exit(1)
    }

    console.log(`✅ Found channel: #${targetChannel.name} in guild "${targetGuild.name}"`)

    // Check channel type
    if (targetChannel.type !== 'GUILD_TEXT' && targetChannel.type !== 0) {
      console.error(`❌ Channel ${channelId} is not a text channel`)
      process.exit(1)
    }

    // Check bot permissions
    const botMember = targetGuild.members.cache.get(client.user.id)
    if (!botMember) {
      console.error(`❌ Bot not found as member in guild ${targetGuild.id}`)
      process.exit(1)
    }

    const permissions = targetChannel.permissionsFor(botMember)
    if (!permissions || !permissions.has('VIEW_CHANNEL') || !permissions.has('READ_MESSAGE_HISTORY')) {
      console.error(`❌ Bot lacks permissions to read messages in channel ${channelId}`)
      process.exit(1)
    }

    console.log('✅ Channel accessible with proper permissions')

    // Fetch messages from Discord
    console.log('\n📥 Fetching messages from Discord...')
    let fetchedMessages = []

    // Function to fetch messages from a single channel
    async function fetchMessagesFromChannel (channel, channelName) {
      console.log(`\n📥 Fetching messages from ${channelName}...`)
      let channelMessages = []
      let lastMessageId = null
      let hasMore = true
      let batchCount = 0

      while (hasMore) {
        const fetchOptions = {
          limit: 100
        }

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
          return msgDate >= startDate && msgDate <= endDate
        })

        const newMessages = Array.from(relevantMessages.values())
        channelMessages = channelMessages.concat(newMessages)

        console.log(`    📝 Found ${newMessages.length} messages in date range (${messages.size} total in batch)`)

        // Check if we've gone past our start date
        const oldestMessage = messages.last()
        if (oldestMessage && new Date(oldestMessage.createdTimestamp) < startDate) {
          console.log(`    ✅ Reached messages older than start date in ${channelName}`)
          hasMore = false
        } else if (messages.size < 100) {
          console.log(`    ✅ Reached end of ${channelName} history`)
          hasMore = false
        } else {
          lastMessageId = oldestMessage.id
        }

        // Rate limit between batch requests
        await sleep(500) // 500ms between batches
      }

      return channelMessages
    }

    // Fetch from main channel
    const mainChannelMessages = await fetchMessagesFromChannel(targetChannel, `main channel #${targetChannel.name}`)
    fetchedMessages = fetchedMessages.concat(mainChannelMessages)

    // Find and fetch from thread channels
    console.log('\n🧵 Looking for thread channels...')

    // First check cached threads
    const cachedThreadChannels = targetGuild.channels.cache.filter(channel => {
      const isThread = channel.type === 10 || channel.type === 11 || channel.type === 12 // GUILD_NEWS_THREAD, GUILD_PUBLIC_THREAD, GUILD_PRIVATE_THREAD
      return isThread && channel.parentId === channelId
    })

    console.log(`📝 Found ${cachedThreadChannels.size} cached thread channels`)

    // Also fetch archived threads from the API
    const allThreadChannels = new Map(cachedThreadChannels)

    try {
      console.log('📥 Fetching active and archived threads from API...')

      // Fetch active threads
      const activeThreads = await targetChannel.threads.fetchActive()
      console.log(`📝 Found ${activeThreads.threads.size} active threads`)
      activeThreads.threads.forEach((thread, id) => {
        allThreadChannels.set(id, thread)
      })

      // Fetch archived threads
      const archivedThreads = await targetChannel.threads.fetchArchived()
      console.log(`📝 Found ${archivedThreads.threads.size} archived threads`)
      archivedThreads.threads.forEach((thread, id) => {
        allThreadChannels.set(id, thread)
      })

      // Also fetch private archived threads if we have permission
      try {
        const privateArchivedThreads = await targetChannel.threads.fetchArchived({ type: 'private' })
        console.log(`📝 Found ${privateArchivedThreads.threads.size} private archived threads`)
        privateArchivedThreads.threads.forEach((thread, id) => {
          allThreadChannels.set(id, thread)
        })
      } catch (privateError) {
        console.log('⚠️  Could not fetch private archived threads (insufficient permissions)')
      }
    } catch (threadFetchError) {
      console.error('❌ Error fetching threads from API:', threadFetchError.message)
      console.log('📝 Will use only cached threads')
    }

    console.log(`📝 Found ${allThreadChannels.size} total thread channels`)

    for (const [threadId, threadChannel] of allThreadChannels) {
      try {
        // Check bot permissions for thread
        const threadPermissions = threadChannel.permissionsFor(botMember)
        if (!threadPermissions || !threadPermissions.has('VIEW_CHANNEL') || !threadPermissions.has('READ_MESSAGE_HISTORY')) {
          console.log(`    ⚠️  Skipping thread "${threadChannel.name}" - insufficient permissions`)
          continue
        }

        const threadMessages = await fetchMessagesFromChannel(threadChannel, `thread "${threadChannel.name}"`)
        fetchedMessages = fetchedMessages.concat(threadMessages)

        // Rate limit between threads
        await sleep(1000)
      } catch (threadError) {
        console.error(`    ❌ Error fetching from thread "${threadChannel.name}":`, threadError.message)
      }
    }

    console.log(`\n📊 Found ${fetchedMessages.length} total messages in date range`)

    if (fetchedMessages.length === 0) {
      console.log('✅ No messages to process')
      return
    }

    // Process and save messages
    console.log('\n💾 Saving messages to database...')
    let savedCount = 0
    let skippedCount = 0

    for (const discordMsg of fetchedMessages) {
      try {
        // Check if message already exists
        const existingMessage = await Message.findOne({
          id: discordMsg.id
        })

        if (existingMessage) {
          skippedCount++
          continue // Skip if already exists
        }

        // Determine channel info based on whether this is a thread message
        const isInThread = discordMsg.channel.type === 10 || discordMsg.channel.type === 11 || discordMsg.channel.type === 12

        // For thread messages, we want to:
        // 1. Store them with the parent channel ID (for querying purposes)
        // 2. Set threadId to the thread channel ID (which equals the starter message ID)
        const actualChannelId = isInThread ? discordMsg.channel.parentId : discordMsg.channel.id
        const actualChannelName = isInThread ? targetChannel.name : discordMsg.channel.name

        // Create message document with complete Discord data
        const messageDoc = new Message({
          // Basic fields (keeping existing structure)
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

        await messageDoc.save()
        savedCount++

        if (savedCount % 50 === 0) {
          console.log(`    📝 Saved ${savedCount} messages so far...`)
        }
      } catch (saveError) {
        console.error(`    ❌ Error saving message ${discordMsg.id}:`, saveError.message)
      }
    }

    console.log('\n📊 Seeding Summary:')
    console.log(`- Channel: #${targetChannel.name} (${channelId})`)
    console.log(`- Guild: ${targetGuild.name} (${targetGuild.id})`)
    console.log(`- Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    console.log(`- Messages found: ${fetchedMessages.length}`)
    console.log(`- Messages saved: ${savedCount}`)
    console.log(`- Messages skipped (already exist): ${skippedCount}`)
    console.log('✅ Channel range seeding completed')
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error)
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
  seedChannelRange()
}

module.exports = seedChannelRange
