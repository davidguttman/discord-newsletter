const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
})

// Ensure unique guild/channel combinations
settingsSchema.index({ guildId: 1, channelId: 1 }, { unique: true })

module.exports = mongoose.model('Settings', settingsSchema)
