require('dotenv').config()

const config = {
  token: process.env.DISCORD_TOKEN,
  guildChannels: process.env.GUILD_CHANNELS ? process.env.GUILD_CHANNELS.split(',').map(entry => {
    const [guildId, channelId] = entry.split(':')
    return { guildId, channelId }
  }) : [],
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/discord-export'
}

module.exports = config 