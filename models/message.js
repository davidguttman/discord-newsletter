const mongoose = require('../lib/mongo')

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: false,
    default: ''
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
  }],

  // Rich Discord data from raw API
  messageType: String, // "DEFAULT", "REPLY", etc.
  system: Boolean,
  pinned: Boolean,
  tts: Boolean,
  flags: Number,
  position: Number, // Position in thread
  cleanContent: String, // Discord's cleaned content

  // Complete mention data
  mentions: {
    everyone: Boolean,
    users: [String], // Array of user IDs
    roles: [String], // Array of role IDs
    repliedUser: String, // ID of replied user
    channels: [String] // Array of channel IDs
  },

  // Complete reference data for replies
  reference: {
    messageId: String,
    channelId: String,
    guildId: String,
    type: String // "DEFAULT", etc.
  },

  // Channel metadata
  channelType: String, // "GUILD_TEXT", "GUILD_PUBLIC_THREAD", etc.
  isThread: Boolean,

  // Raw Discord timestamps
  createdTimestamp: Number,
  editedTimestamp: Number,

  // Additional Discord fields that might be useful
  webhookId: String,
  applicationId: String,
  nonce: String,

  // Store complete raw Discord data for future-proofing
  rawDiscordData: mongoose.Schema.Types.Mixed
}, {
  // timestamps: true // Removed as createdAt/updatedAt are handled explicitly
})

// Create index for faster queries
messageSchema.index({ guildId: 1, channelId: 1 })
messageSchema.index({ createdAt: 1 })

const Message = mongoose.model('Message', messageSchema)

module.exports = Message
