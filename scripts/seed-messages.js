#!/usr/bin/env node

const config = require('../config')
const mongoose = require('../lib/mongo')
const discord = require('../lib/discord')
const Settings = require('../models/settings')
const Message = require('../models/message')

// Rate limiting delay between requests (in milliseconds)
const DELAY_BETWEEN_REQUESTS = 2000 // 2 seconds

async function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function seedMessages () {
  try {
    console.log('Starting message seeding process...')

    // Start Discord client
    console.log('Starting Discord client...')
    await discord.start()

    // Get Discord client
    const client = discord.getClient()
    console.log(`✅ Discord client ready as ${client.user.tag}`)

    // Get all active channels from settings
    const activeChannels = await Settings.find()
    console.log(`Found ${activeChannels.length} active channels`)

    if (activeChannels.length === 0) {
      console.log('No active channels configured. Exiting.')
      return
    }

    // Calculate time range for last 24 hours
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)) // 24 hours ago

    console.log(`Fetching messages from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    let totalMessages = 0
    let totalChannelsProcessed = 0

    // Process each channel serially with rate limiting
    for (const channelSetting of activeChannels) {
      const { guildId, channelId } = channelSetting

      try {
        console.log(`\nProcessing channel ${channelId} in guild ${guildId}...`)

        // Get the Discord guild and channel
        const guild = client.guilds.cache.get(guildId)
        if (!guild) {
          console.log(`  ❌ Guild ${guildId} not found or bot not in guild`)
          continue
        }

        const channel = guild.channels.cache.get(channelId)
        if (!channel) {
          console.log(`  ❌ Channel ${channelId} not found in guild ${guildId}`)
          continue
        }

        if (channel.type !== 'GUILD_TEXT' && channel.type !== 0) {
          console.log(`  ❌ Channel ${channelId} is not a text channel`)
          continue
        }

        // Check bot permissions
        const botMember = guild.members.cache.get(client.user.id)
        if (!botMember) {
          console.log(`  ❌ Bot not found as member in guild ${guildId}`)
          continue
        }

        const permissions = channel.permissionsFor(botMember)
        if (!permissions || !permissions.has('VIEW_CHANNEL') || !permissions.has('READ_MESSAGE_HISTORY')) {
          console.log(`  ❌ Bot lacks permissions to read messages in channel ${channelId}`)
          continue
        }

        console.log(`  ✅ Channel accessible: #${channel.name}`)

        // Fetch messages from Discord
        let fetchedMessages = []
        let lastMessageId = null
        let hasMore = true

        while (hasMore) {
          const fetchOptions = {
            limit: 100
          }

          if (lastMessageId) {
            fetchOptions.before = lastMessageId
          }

          console.log('    Fetching batch of messages...')
          const messages = await channel.messages.fetch(fetchOptions)

          if (messages.size === 0) {
            hasMore = false
            break
          }

          // Filter messages within our time range
          const relevantMessages = messages.filter(msg => {
            const msgDate = new Date(msg.createdTimestamp)
            return msgDate >= startDate && msgDate <= endDate
          })

          fetchedMessages = fetchedMessages.concat(Array.from(relevantMessages.values()))

          // Check if we've gone past our start date
          const oldestMessage = messages.last()
          if (oldestMessage && new Date(oldestMessage.createdTimestamp) < startDate) {
            hasMore = false
          } else if (messages.size < 100) {
            hasMore = false
          } else {
            lastMessageId = oldestMessage.id
          }

          // Rate limit between batch requests
          await sleep(500) // 500ms between batches
        }

        console.log(`    Found ${fetchedMessages.length} messages in time range`)

        // Process and save messages
        let savedCount = 0
        for (const discordMsg of fetchedMessages) {
          try {
            // Check if message already exists
            const existingMessage = await Message.findOne({
              id: discordMsg.id
            })

            if (existingMessage) {
              continue // Skip if already exists
            }

            // Create message document
            const messageDoc = new Message({
              id: discordMsg.id,
              content: discordMsg.content || '', // Default to empty string if no content
              authorId: discordMsg.author.id,
              authorUsername: discordMsg.author.username,
              channelId,
              channelName: channel.name,
              guildId,
              guildName: channel.guild.name,
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
          } catch (saveError) {
            console.error(`    ❌ Error saving message ${discordMsg.id}:`, saveError.message)
          }
        }

        console.log(`    💾 Saved ${savedCount} new messages`)
        totalMessages += savedCount
        totalChannelsProcessed++

        // Rate limit between channels
        console.log(`    ⏱️  Waiting ${DELAY_BETWEEN_REQUESTS}ms before next channel...`)
        await sleep(DELAY_BETWEEN_REQUESTS)
      } catch (channelError) {
        console.error(`  ❌ Error processing channel ${channelId}:`, channelError.message)
      }
    }

    console.log('\n📊 Seeding Summary:')
    console.log(`- Channels processed: ${totalChannelsProcessed}/${activeChannels.length}`)
    console.log(`- Total messages saved: ${totalMessages}`)
    console.log('✅ Message seeding completed')
  } catch (error) {
    console.error('❌ Fatal error during message seeding:', error)
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
  seedMessages()
}

module.exports = seedMessages
