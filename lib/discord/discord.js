const { Client } = require('discord.js-selfbot-v13')
const Message = require('../../models/message')
const Settings = require('../../models/settings')
const fs = require('fs')
const path = require('path')

const client = new Client({
  checkUpdate: false
})

// Collection of messages for fixtures
const messageCollection = new Map()

async function start () {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN environment variable is required')
  }

  // Just connect to Discord - don't require settings to be configured yet
  console.log('Starting Discord client...')

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
  if (process.env.COLLECT_FIXTURES) {
    await saveMessageFixtures()
  }
  await client.destroy()
}

async function handleMessage (message) {
  if (message.partial) return
  if (!message.guild) return

  // Get current settings from database only
  const settings = await Settings.findOne().sort({ createdAt: -1 })

  if (!settings) {
    // No settings configured, skip processing
    return
  }

  const guildChannels = [{ guildId: settings.guildId, channelId: settings.channelId }]

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
    console.log('\n📨 INCOMING MESSAGE TO DATABASE:')
    console.log(`   ID: ${message.id}`)
    console.log(`   Author: ${message.author.username} (${message.author.id})`)
    console.log(`   Content: "${message.content}"`)
    console.log(`   Channel: #${message.channel.name} (${message.channel.id})`)
    console.log(`   Guild: ${message.guild.name} (${message.guild.id})`)
    console.log(`   Type: ${message.type}`)
    console.log(`   Is Thread: ${message.channel.isThread()}`)
    if (message.channel.isThread()) {
      console.log(`   Thread ID: ${message.channel.id}`)
      console.log(`   Parent Channel: ${message.channel.parentId}`)
    }
    if (message.reference) {
      console.log(`   Reply To: ${message.reference.messageId}`)
      console.log(`   Replied User: ${message.mentions.repliedUser?.username || 'unknown'}`)
    }
    console.log(`   Mentions: ${message.mentions.users.size} users, ${message.mentions.roles.size} roles, everyone: ${message.mentions.everyone}`)
    console.log(`   Created: ${new Date(message.createdTimestamp).toISOString()}`)
    
    const savedMessage = await saveMessage(message)
    console.log(`✅ Saved message ${message.id} - ${savedMessage.wasInserted ? 'NEW' : 'UPDATED'}`)

    // If collecting fixtures, store the raw message data
    if (process.env.COLLECT_FIXTURES) {
      const fixtureData = {
        raw: {
          id: message.id,
          content: message.content,
          author: {
            id: message.author.id,
            username: message.author.username
          },
          channel: {
            id: message.channel.id,
            name: message.channel.name,
            isThread: message.channel.isThread(),
            parentId: message.channel.isThread() ? message.channel.parentId : null
          },
          guild: {
            id: message.guild.id,
            name: message.guild.name
          },
          createdAt: message.createdAt,
          editedAt: message.editedAt,
          reference: message.reference,
          mentions: {
            users: Array.from(message.mentions.users.values()).map(u => ({ id: u.id, username: u.username }))
          },
          attachments: Array.from(message.attachments.values()),
          embeds: message.embeds
        },
        saved: savedMessage
      }
      messageCollection.set(message.id, fixtureData)
      console.log('Collected fixture for message:', message.id)
    }
  } catch (err) {
    console.error('Error saving message:', err)
  }
}

async function saveMessageFixtures () {
  if (messageCollection.size === 0) {
    console.log('No fixtures to save')
    return
  }

  const fixturesDir = path.join(process.cwd(), 'test', 'fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  const fixtures = Array.from(messageCollection.values())
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(fixturesDir, `discord-messages-${timestamp}.json`)

  fs.writeFileSync(filePath, JSON.stringify(fixtures, null, 2))
  console.log(`Saved ${fixtures.length} fixtures to ${filePath}`)
}

async function saveMessage (message) {
  const messageData = {
    // Basic fields (keeping existing structure)
    id: message.id,
    content: message.content,
    authorId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channel.id,
    channelName: message.channel.name,
    guildId: message.guild?.id,
    guildName: message.guild?.name,
    threadId: message.channel.isThread() ? message.channel.id : null,
    parentId: message.channel.isThread() ? message.channel.parentId : null,
    createdAt: message.createdAt,
    updatedAt: message.editedAt || message.createdAt,
    replyToId: message.reference?.messageId || null,
    mentionsReplyTarget: message.reference?.messageId && message.mentions?.users?.has(message.reference.messageId),
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
    })),
    
    // Rich Discord data
    messageType: message.type,
    system: message.system,
    pinned: message.pinned,
    tts: message.tts,
    flags: message.flags,
    position: message.position,
    cleanContent: message.cleanContent,
    
    // Complete mention data
    mentions: {
      everyone: message.mentions.everyone,
      users: Array.from(message.mentions.users.keys()),
      roles: Array.from(message.mentions.roles.keys()),
      repliedUser: message.mentions.repliedUser?.id || null,
      channels: Array.from(message.mentions.channels.keys())
    },
    
    // Complete reference data
    reference: message.reference ? {
      messageId: message.reference.messageId,
      channelId: message.reference.channelId,
      guildId: message.reference.guildId,
      type: message.reference.type
    } : null,
    
    // Channel metadata
    channelType: message.channel.type,
    isThread: message.channel.isThread(),
    
    // Raw Discord timestamps
    createdTimestamp: message.createdTimestamp,
    editedTimestamp: message.editedTimestamp,
    
    // Additional Discord fields
    webhookId: message.webhookId,
    applicationId: message.applicationId,
    nonce: message.nonce,
    
    // Store complete raw Discord data for future-proofing
    rawDiscordData: message.toJSON()
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
  stop,
  getClient: () => client
}
