#!/usr/bin/env node

const mongoose = require('../lib/mongo')

async function createRichMessagesCollection () {
  try {
    console.log('🗄️  Creating new rich_messages collection...')
    await mongoose.connection

    // Create the rich_messages collection with the new schema
    const richMessageSchema = new mongoose.Schema({
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
      reference: mongoose.Schema.Types.Mixed,

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
      timestamps: false // We handle createdAt/updatedAt explicitly
    })

    // Create indexes for performance
    richMessageSchema.index({ guildId: 1, channelId: 1 })
    richMessageSchema.index({ createdAt: 1 })
    richMessageSchema.index({ threadId: 1 })
    richMessageSchema.index({ messageType: 1 })
    richMessageSchema.index({ authorId: 1 })
    richMessageSchema.index({ 'reference.messageId': 1 })

    const RichMessage = mongoose.model('RichMessage', richMessageSchema, 'rich_messages')

    // Drop the collection if it exists and recreate
    try {
      await RichMessage.collection.drop()
      console.log('✅ Dropped existing rich_messages collection')
    } catch (dropError) {
      console.log('📝 Collection rich_messages did not exist, creating new')
    }

    // Create the collection
    await RichMessage.createCollection()
    console.log('✅ Created rich_messages collection with indexes')

    // Create all indexes
    await RichMessage.createIndexes()
    console.log('✅ Created all indexes for rich_messages collection')

    console.log('\n📊 Rich Messages Collection Details:')
    console.log('- Collection: rich_messages')
    console.log('- Indexes: guildId+channelId, createdAt, threadId, messageType, authorId, reference.messageId')
    console.log('- Schema: Complete Discord message structure with rich metadata')
    console.log('- Ready for: Thread messages, reply chains, mentions, complete Discord data')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating rich_messages collection:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  createRichMessagesCollection()
}

module.exports = createRichMessagesCollection
