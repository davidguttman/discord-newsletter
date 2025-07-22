const express = require('express')
const router = express.Router()
const autoCatch = require('../lib/auto-catch')

// Import Discord client (but we need to expose it from the discord service)
let discordClient = null

// Function to set the Discord client reference
function setDiscordClient (client) {
  discordClient = client
}

// GET /guilds - Get all guilds the bot is in
router.get('/', autoCatch(async (req, res) => {
  if (!discordClient || !discordClient.user) {
    return res.status(503).json({ 
      error: 'Discord client not ready. Please configure settings first.',
      needsSettings: true 
    })
  }

  const guilds = Array.from(discordClient.guilds.cache.values()).map(guild => ({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL(),
    memberCount: guild.memberCount
  }))

  res.json(guilds)
}))

// GET /guilds/:guildId/channels - Get channels for a specific guild
router.get('/:guildId/channels', autoCatch(async (req, res) => {
  console.log(`Channels request for guild: ${req.params.guildId}`)
  console.log(`Discord client ready: ${!!(discordClient && discordClient.user)}`)
  
  if (!discordClient || !discordClient.user) {
    console.log('Discord client not ready')
    return res.status(503).json({ 
      error: 'Discord client not ready',
      needsSettings: true 
    })
  }

  const guild = discordClient.guilds.cache.get(req.params.guildId)
  console.log(`Guild found: ${!!guild}`)
  
  if (!guild) {
    console.log('Guild not found in cache')
    return res.status(404).json({ error: 'Guild not found' })
  }

  const channels = Array.from(guild.channels.cache.values())
    .filter(channel => {
      // Only text channels
      if (channel.type !== 'GUILD_TEXT' && channel.type !== 0) return false
      
      // Check if bot has both VIEW_CHANNEL and READ_MESSAGE_HISTORY permissions
      const botMember = guild.members.cache.get(discordClient.user.id)
      if (!botMember) return false
      
      const permissions = channel.permissionsFor(botMember)
      return permissions && 
             permissions.has('VIEW_CHANNEL') && 
             permissions.has('READ_MESSAGE_HISTORY')
    })
    .map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.position
    }))
    .sort((a, b) => a.position - b.position)

  console.log(`Found ${channels.length} channels`)
  res.json(channels)
}))

module.exports = { router, setDiscordClient }