const mongoose = require('../lib/mongo')

const summarySchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  since: {
    type: String,
    required: true,
    default: '24h'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  messageCount: {
    type: Number,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  usage: {
    prompt_tokens: Number,
    completion_tokens: Number,
    total_tokens: Number
  },
  metadata: {
    approach: String,
    topicsFound: Number,
    storiesGenerated: Number,
    topics: [{
      description: String,
      substance: Number
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

// Index for efficient queries - find recent summaries for a channel
summarySchema.index({ guildId: 1, channelId: 1, since: 1, createdAt: -1 })

module.exports = mongoose.model('Summary', summarySchema)
