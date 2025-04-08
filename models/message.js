const mongoose = require('../lib/mongo')

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: true
  },
  authorUsername: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  channelName: {
    type: String,
    required: true
  },
  guildId: {
    type: String
  },
  guildName: {
    type: String
  },
  threadId: {
    type: String,
    default: null
  },
  parentId: {
    type: String
  },
  createdAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date,
    required: true
  },
  replyToId: {
    type: String,
    default: null
  },
  mentionsReplyTarget: {
    type: Boolean,
    default: false
  },
  attachments: [{
    id: String,
    url: String,
    name: String,
    size: Number
  }],
  embeds: [{
    type: {
      type: String,
      required: true
    },
    title: String,
    description: String,
    url: String
  }]
}, {
  // timestamps: true // Removed as createdAt/updatedAt are handled explicitly
})

// Create index for faster queries
messageSchema.index({ guildId: 1, channelId: 1 })
messageSchema.index({ createdAt: 1 })

const Message = mongoose.model('Message', messageSchema)

module.exports = Message
