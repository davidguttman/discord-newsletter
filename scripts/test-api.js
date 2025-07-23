#!/usr/bin/env node

const fs = require('fs')
const ApiClient = require('../lib/api-client')

// Create API client instance
const api = new ApiClient('https://discnews.jump.sh')

async function main () {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  console.log(`Running command: ${command}`)

  try {
    switch (command) {
      case 'guilds':
        const guilds = await api.getGuilds()
        console.log(JSON.stringify(guilds, null, 2))
        break

      case 'channels':
        if (!args[0]) {
          console.error('Usage: node test-api.js channels <guildId> [--save filename]')
          process.exit(1)
        }
        const guildId = args[0]
        const channels = await api.getChannels(guildId)

        // Check if we should save to file
        const saveIndex = args.indexOf('--save')
        if (saveIndex !== -1 && args[saveIndex + 1]) {
          const filename = args[saveIndex + 1]
          fs.writeFileSync(filename, JSON.stringify(channels, null, 2))
          console.log(`Channels data saved to ${filename}`)
        } else {
          console.log(JSON.stringify(channels, null, 2))
        }
        break

      case 'preview':
        if (!args[0] || !args[1]) {
          console.error('Usage: node test-api.js preview <guildId> <channelId> [limit]')
          process.exit(1)
        }
        const previewGuildId = args[0]
        const channelId = args[1]
        const limit = parseInt(args[2]) || 10
        const preview = await api.getPreview(previewGuildId, channelId, limit)
        console.log(JSON.stringify(preview, null, 2))
        break

      case 'messages':
        if (!args[0] || !args[1]) {
          console.error('Usage: node test-api.js messages <guildId> <channelId> [limit] [sort]')
          process.exit(1)
        }
        const msgGuildId = args[0]
        const msgChannelId = args[1]
        const msgLimit = args[2] || '20'
        const sort = args[3] || '-createdAt'
        const messages = await api.getMessages(msgGuildId, msgChannelId, {
          limit: msgLimit,
          sort
        })
        console.log(JSON.stringify(messages, null, 2))
        break

      case 'settings':
        const settings = await api.getSettings()
        console.log(JSON.stringify(settings, null, 2))
        break

      case 'health':
        const health = await api.getHealth()
        console.log(JSON.stringify(health, null, 2))
        break

      default:
        console.log('Available commands:')
        console.log('  guilds                                    - Get all guilds')
        console.log('  channels <guildId> [--save filename]     - Get channels for guild')
        console.log('  preview <guildId> <channelId> [limit]    - Get preview messages')
        console.log('  messages <guildId> <channelId> [limit]   - Get stored messages')
        console.log('  settings                                 - Get current settings')
        console.log('  health                                   - Check API health')
        process.exit(1)
    }
  } catch (error) {
    console.error('API Error:', error.message)
    process.exit(1)
  }
}

main()
