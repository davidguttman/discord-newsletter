const { Client } = require('discord.js-selfbot-v13')
const config = require('../../config')
const db = require('../db')

const client = new Client({
  checkUpdate: false
})

async function start () {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN environment variable is required')
  }

  if (!config.guildChannels.length) {
    throw new Error('GUILD_CHANNELS environment variable is required')
  }

  // Validate channel format
  const invalidChannels = config.guildChannels.filter(({ guildId, channelId }) => !guildId || !channelId)
  if (invalidChannels.length) {
    throw new Error('Invalid GUILD_CHANNELS format. Use "guildId:channelId,guildId:channelId"')
  }

  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
  })

  client.on('messageCreate', handleMessage)
  client.on('messageUpdate', (oldMessage, newMessage) => {
    if (newMessage.partial) return
    handleMessage(newMessage)
  })

  await client.login(config.token)
}

async function stop () {
  await client.destroy()
  await db.disconnect()
}

async function handleMessage (message) {
  if (message.partial) return
  if (!message.guild) return

  const isConfiguredChannel = config.guildChannels.some(
    ({ guildId, channelId }) => {
      // Check if message is directly in the configured channel
      if (message.guild.id === guildId && message.channel.id === channelId) {
        return true
      }
      
      // Check if message is in a thread of the configured channel
      if (message.guild.id === guildId && 
          message.channel.isThread() && 
          message.channel.parentId === channelId) {
        return true
      }
      
      return false
    }
  )

  if (!isConfiguredChannel) return

  try {
    await db.saveMessage(message)
    console.log(`Saved message ${message.id} from guild ${message.guild.id} channel ${message.channel.id}`)
  } catch (err) {
    console.error('Error saving message:', err)
  }
}

module.exports = {
  start,
  stop
} 