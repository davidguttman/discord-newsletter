const express = require('express')
const router = express.Router()
const autoCatch = require('../lib/auto-catch')

// Import Discord client reference
let discordClient = null

// Function to set the Discord client reference
function setDiscordClient (client) {
  console.log('Preview API: Setting Discord client', !!client, client?.user?.username)
  discordClient = client
}

// GET /preview/:guildId/:channelId - Get preview messages from Discord
router.get('/:guildId/:channelId', autoCatch(async (req, res) => {
  const { guildId, channelId } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 10, 20) // Max 20 messages

  if (!discordClient || !discordClient.user) {
    return res.status(503).json({
      error: 'Discord client not ready',
      needsSettings: true
    })
  }

  const guild = discordClient.guilds.cache.get(guildId)
  if (!guild) {
    return res.status(404).json({ error: 'Guild not found' })
  }

  const channel = guild.channels.cache.get(channelId)
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' })
  }

  if (channel.type !== 'GUILD_TEXT' && channel.type !== 0) {
    return res.status(400).json({ error: 'Channel is not a text channel' })
  }

  try {
    const messages = await channel.messages.fetch({ limit })

    const previewMessages = Array.from(messages.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(message => ({
        id: message.id,
        content: message.content,
        authorUsername: message.author.username,
        authorId: message.author.id,
        createdAt: message.createdAt.toISOString(),
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
      }))

    res.json({
      messages: previewMessages,
      isPreview: true,
      guildName: guild.name,
      channelName: channel.name
    })
  } catch (error) {
    console.error('Error fetching preview messages from Discord:', error.message, error.code)
    if (error.code === 50001) {
      res.status(403).json({ error: 'Bot lacks permissions to read messages in this channel' })
    } else if (error.code === 10003) {
      res.status(404).json({ error: 'Channel not found' })
    } else if (error.code === 50013) {
      res.status(403).json({ error: 'Missing access to channel' })
    } else {
      res.status(500).json({ error: 'Failed to fetch preview messages' })
    }
  }
}))

module.exports = { router, setDiscordClient }
