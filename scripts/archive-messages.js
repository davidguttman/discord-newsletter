#!/usr/bin/env node

const { Client } = require('discord.js-selfbot-v13')
const db = require('../lib/db')
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

    let totalStats = {
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

    console.log(`\nArchiving complete!`)
    console.log(`Total messages processed: ${totalStats.total}`)
    console.log(`New messages: ${totalStats.new}`)
    console.log(`Updated messages: ${totalStats.updated}`)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.destroy()
    await db.disconnect()
  }
}

async function archiveChannelMessages (channel, options) {
  let stats = {
    total: 0,
    updated: 0,
    new: 0
  }
  let lastMessageId = null
  let done = false

  while (!done) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: lastMessageId
    })

    if (messages.size === 0) {
      done = true
      continue
    }

    for (const message of messages.values()) {
      if (message.createdAt < options.start) {
        done = true
        break
      }

      if (message.createdAt <= options.end && message.createdAt >= options.start) {
        const result = await db.saveMessage(message)
        stats.total++
        if (result.wasUpdated) stats.updated++
        if (result.wasInserted) stats.new++
        
        if (stats.total % 100 === 0) {
          console.log(`Progress: ${stats.total} messages processed (${stats.new} new, ${stats.updated} updated)`)
        }
      }

      lastMessageId = message.id
    }
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