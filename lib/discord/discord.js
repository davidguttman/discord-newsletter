const { Client } = require('discord.js-selfbot-v13')
const Message = require('../../models/message')

const client = new Client({
  checkUpdate: false
})

async function start () {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN environment variable is required')
  }

  if (!process.env.GUILD_CHANNELS) {
    throw new Error('GUILD_CHANNELS environment variable is required')
  }

  // Parse guild channels
  const guildChannels = process.env.GUILD_CHANNELS.split(',').map(pair => {
    const [guildId, channelId] = pair.split(':')
    return { guildId, channelId }
  })

  // Validate channel format
  const invalidChannels = guildChannels.filter(({ guildId, channelId }) => !guildId || !channelId)
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

  await client.login(process.env.DISCORD_TOKEN)
}

async function stop () {
  await client.destroy()
}

async function handleMessage (message) {
  if (message.partial) return
  if (!message.guild) return

  const guildChannels = process.env.GUILD_CHANNELS.split(',').map(pair => {
    const [guildId, channelId] = pair.split(':')
    return { guildId, channelId }
  })

  const isConfiguredChannel = guildChannels.some(
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
    await saveMessage(message)
    console.log(`Saved message ${message.id} from guild ${message.guild.id} channel ${message.channel.id}`)
  } catch (err) {
    console.error('Error saving message:', err)
  }
}

async function saveMessage (message) {
  const messageData = {
    id: message.id,
    content: message.content,
    authorId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channel.id,
    guildId: message.guild?.id,
    threadId: message.channel.isThread() ? message.channel.id : null,
    parentId: message.channel.isThread() ? message.channel.parentId : null,
    createdAt: message.createdAt,
    updatedAt: message.editedAt || message.createdAt,
    replyToId: message.reference?.messageId || null,
    mentionsReplyTarget: message.mentions?.repliedUser || false,
    attachments: message.attachments.map(a => ({
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
    }))
  }

  const result = await Message.findOneAndUpdate(
    { id: message.id },
    { $set: messageData },
    { upsert: true, new: true }
  )

  return {
    messageId: message.id,
    wasUpdated: result.__v > 0,
    wasInserted: result.__v === 0
  }
}

module.exports = {
  start,
  stop
}
