#!/usr/bin/env node

const { Client } = require('discord.js-selfbot-v13')
const mongoose = require('../lib/mongo') // Connects to MongoDB
const Message = require('../models/message') // Message schema/model
require('dotenv').config()

const usage = `
Usage: node archive-messages.js [options]

Options:
  --start <date>     Start date (ISO format, e.g. 2024-03-20)
  --end <date>       End date (ISO format, e.g. 2024-03-21)
  --channel <id>     Channel ID to archive
  --guild <id>       Guild ID the channel belongs to
  --help             Show this help message

Example:
  node archive-messages.js --start 2024-03-20 --end 2024-03-21 --channel 123456789 --guild 987654321
`

async function parseArgs () {
  const args = process.argv.slice(2)
  const options = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start':
        options.start = new Date(args[++i])
        break
      case '--end':
        options.end = new Date(args[++i])
        break
      case '--channel':
        options.channelId = args[++i]
        break
      case '--guild':
        options.guildId = args[++i]
        break
      case '--help':
        console.log(usage)
        process.exit(0)
    }
  }

  if (!options.start || isNaN(options.start.getTime())) {
    console.error('Error: Valid --start date required')
    console.log(usage)
    process.exit(1)
  }

  if (!options.end || isNaN(options.end.getTime())) {
    console.error('Error: Valid --end date required')
    console.log(usage)
    process.exit(1)
  }

  if (!options.channelId) {
    console.error('Error: --channel ID required')
    console.log(usage)
    process.exit(1)
  }

  if (!options.guildId) {
    console.error('Error: --guild ID required')
    console.log(usage)
    process.exit(1)
  }

  return options
}

async function archiveMessages (options) {
  const client = new Client({
    checkUpdate: false
  })

  if (!process.env.DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN environment variable is required')
    process.exit(1)
  }

  console.log('Connecting to Discord...')
  await client.login(process.env.DISCORD_TOKEN)

  try {
    const guild = await client.guilds.fetch(options.guildId)
    const channel = await guild.channels.fetch(options.channelId)

    if (!channel) {
      throw new Error(`Channel ${options.channelId} not found in guild ${options.guildId}`)
    }

    console.log(`Archiving messages from ${channel.name} (${options.start.toISOString()} to ${options.end.toISOString()})`)

    const totalStats = {
      total: 0,
      updated: 0,
      new: 0
    }

    // Archive messages from the main channel
    const mainChannelStats = await archiveChannelMessages(channel, options)
    Object.keys(totalStats).forEach(key => { totalStats[key] += mainChannelStats[key] })

    // Get and archive messages from all threads in the channel
    const threads = await channel.threads.fetch()
    for (const thread of threads.threads.values()) {
      console.log(`\nArchiving messages from thread: ${thread.name}`)
      const threadStats = await archiveChannelMessages(thread, options)
      Object.keys(totalStats).forEach(key => { totalStats[key] += threadStats[key] })
    }

    console.log('\nArchiving complete!')
    console.log(`Total messages processed: ${totalStats.total}`)
    console.log(`New messages: ${totalStats.new}`)
    console.log(`Updated messages: ${totalStats.updated}`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.destroy()
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
  }
}

async function archiveChannelMessages (channel, options) {
  const stats = {
    total: 0,
    updated: 0,
    new: 0
  }
  let lastMessageId = null
  let done = false

  console.log(`[${channel.name}] Starting fetch loop...`)
  while (!done) {
    const fetchOptions = {
      limit: 100
    }
    if (lastMessageId) {
      fetchOptions.before = lastMessageId
    }

    console.log(`[${channel.name}] Fetching messages with options:`, fetchOptions)
    const messages = await channel.messages.fetch(fetchOptions)

    if (messages.size === 0) {
      console.log(`[${channel.name}] Fetched 0 messages. Ending loop.`)
      done = true
      continue
    }

    // Log timestamps of first and last message in the batch
    const firstMessage = messages.first()
    const lastMessageInBatch = messages.last()
    console.log(`[${channel.name}] Fetched batch of ${messages.size}. Range: ${firstMessage.createdAt.toISOString()} -> ${lastMessageInBatch.createdAt.toISOString()}`)

    for (const message of messages.values()) {
      if (message.createdAt < options.start) {
        done = true
        break
      }

      // Log the timestamp of the message being checked against the date range
      console.log(`[${channel.name}] Checking message ${message.id} createdAt: ${message.createdAt.toISOString()}`)

      if (message.createdAt <= options.end && message.createdAt >= options.start) {
        // --- New Mongoose Saving Logic START ---
        const messageData = {
          id: message.id,
          content: message.content,
          authorId: message.author.id,
          authorUsername: message.author.username,
          channelId: message.channel.id,
          channelName: message.channel.name,
          guildId: message.guild?.id,
          guildName: message.guild?.name,
          threadId: message.channel.isThread() ? message.channel.id : null,
          parentId: message.channel.isThread() ? message.channel.parentId : message.channel.id, // Use channel ID if not thread
          createdAt: message.createdAt,
          updatedAt: message.editedAt || message.createdAt, // Use editedAt if available
          replyToId: message.reference?.messageId || null,
          mentionsReplyTarget: !!(message.reference?.messageId && message.mentions?.repliedUser), // Check if the reply pinged the user
          attachments: Array.from(message.attachments.values()).map(a => ({
            id: a.id,
            url: a.url,
            name: a.name,
            size: a.size
          })),
          embeds: message.embeds.map(e => ({
            type: e.type,
            title: e.title,
            description: e.description,
            url: e.url
            // Note: The schema might not capture all embed fields (e.g., fields, footer, image, etc.)
            // Adjust the mapping here and in `models/message.js` if more detail is needed.
          }))
        }

        const result = await Message.findOneAndUpdate(
          { id: message.id }, // Find message by its Discord ID
          { $set: messageData }, // Set the data (update)
          { upsert: true, new: true, setDefaultsOnInsert: true } // Options: Insert if not found, return new doc, apply schema defaults
        )

        const wasInserted = !result.__v // __v is 0 for new documents created by Mongoose `upsert`
        const wasUpdated = !wasInserted

        // --- New Mongoose Saving Logic END ---

        stats.total++
        if (wasUpdated) stats.updated++
        if (wasInserted) stats.new++

        if (stats.total % 100 === 0) {
          console.log(`Progress: ${stats.total} messages processed (${stats.new} new, ${stats.updated} updated)`)
        }
      }

      lastMessageId = message.id
    }

    // Update lastMessageId ONLY after processing the batch to ensure the *next* fetch uses the oldest ID from the *current* batch
    lastMessageId = messages.lastKey()
    console.log(`[${channel.name}] Setting lastMessageId for next fetch: ${lastMessageId}`)
  }

  console.log(`Channel complete: ${stats.total} messages processed (${stats.new} new, ${stats.updated} updated)`)
  return stats
}

// Run the script
parseArgs()
  .then(archiveMessages)
  .catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
