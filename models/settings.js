const mongoose = require('mongoose')

const settingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  emailTo: {
    type: String,
    required: true
  },
  emailFrom: {
    type: String,
    required: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Settings', settingsSchema)