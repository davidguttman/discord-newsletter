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

function parseArgs() {
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

async function seedChannelRange() {
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

    console.log(`✅ Channel accessible with proper permissions`)

    // Fetch messages from Discord
    console.log('\n📥 Fetching messages from Discord...')
    let fetchedMessages = []
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
      console.log(`    📦 Fetching batch ${batchCount}...`)
      
      const messages = await targetChannel.messages.fetch(fetchOptions)

      if (messages.size === 0) {
        console.log('    ✅ No more messages found')
        hasMore = false
        break
      }

      // Filter messages within our time range
      const relevantMessages = messages.filter(msg => {
        const msgDate = new Date(msg.createdTimestamp)
        return msgDate >= startDate && msgDate <= endDate
      })

      const newMessages = Array.from(relevantMessages.values())
      fetchedMessages = fetchedMessages.concat(newMessages)
      
      console.log(`    📝 Found ${newMessages.length} messages in date range (${messages.size} total in batch)`)

      // Check if we've gone past our start date
      const oldestMessage = messages.last()
      if (oldestMessage && new Date(oldestMessage.createdTimestamp) < startDate) {
        console.log('    ✅ Reached messages older than start date, stopping')
        hasMore = false
      } else if (messages.size < 100) {
        console.log('    ✅ Reached end of channel history')
        hasMore = false
      } else {
        lastMessageId = oldestMessage.id
      }

      // Rate limit between batch requests
      await sleep(500) // 500ms between batches
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

        // Create message document
        const messageDoc = new Message({
          id: discordMsg.id,
          content: discordMsg.content || '', // Default to empty string if no content
          authorId: discordMsg.author.id,
          authorUsername: discordMsg.author.username,
          channelId,
          channelName: targetChannel.name,
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
            type: embed.type || 'rich', // Default embed type
            title: embed.title,
            description: embed.description,
            url: embed.url
          })),
          // Thread and reply support
          threadId: discordMsg.thread?.id || null,
          parentId: discordMsg.channel?.parent?.id || null,
          replyToId: discordMsg.reference?.messageId || null,
          mentionsReplyTarget: !!discordMsg.reference
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