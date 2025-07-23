#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const mongoose = require('../lib/mongo')
const Message = require('../models/message')

function parseArgs() {
  const args = process.argv.slice(2)
  
  if (args.length < 1) {
    console.log('Usage: node export-messages.js <channelId> [outputFile]')
    console.log('  channelId: Discord channel ID to export')
    console.log('  outputFile: Optional output file path (default: data/channel-<channelId>.json)')
    console.log('')
    console.log('Example: node export-messages.js 1209303473263485011')
    console.log('Example: node export-messages.js 1209303473263485011 my-export.json')
    process.exit(1)
  }
  
  const [channelId, outputFile] = args
  
  const defaultOutput = `data/channel-${channelId}.json`
  const finalOutput = outputFile || defaultOutput
  
  return { channelId, outputFile: finalOutput }
}

async function exportMessages() {
  const { channelId, outputFile } = parseArgs()
  
  try {
    console.log('📤 Starting message export...')
    console.log(`📍 Channel ID: ${channelId}`)
    console.log(`📄 Output file: ${outputFile}`)

    // Ensure data directory exists
    const dataDir = path.dirname(outputFile)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
      console.log(`📁 Created directory: ${dataDir}`)
    }

    // Find all messages for this channel
    console.log('\n🔍 Querying database for messages...')
    const messages = await Message.find({ channelId })
      .sort({ createdAt: 1 }) // Oldest first
      .lean() // Return plain objects, not Mongoose documents

    console.log(`✅ Found ${messages.length} messages`)

    if (messages.length === 0) {
      console.log('❌ No messages found for this channel')
      process.exit(1)
    }

    // Prepare export data
    const exportData = {
      metadata: {
        channelId,
        channelName: messages[0]?.channelName || 'Unknown',
        guildId: messages[0]?.guildId || 'Unknown',
        guildName: messages[0]?.guildName || 'Unknown',
        messageCount: messages.length,
        dateRange: {
          earliest: messages[0]?.createdAt,
          latest: messages[messages.length - 1]?.createdAt
        },
        exportedAt: new Date().toISOString()
      },
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        authorId: msg.authorId,
        authorUsername: msg.authorUsername,
        channelId: msg.channelId,
        channelName: msg.channelName,
        guildId: msg.guildId,
        guildName: msg.guildName,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        attachments: msg.attachments || [],
        embeds: msg.embeds || [],
        threadId: msg.threadId,
        parentId: msg.parentId,
        replyToId: msg.replyToId,
        mentionsReplyTarget: msg.mentionsReplyTarget
      }))
    }

    // Write to file
    console.log('\n💾 Writing to file...')
    fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2))

    // File size info
    const stats = fs.statSync(outputFile)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    console.log('\n📊 Export Summary:')
    console.log(`- Channel: ${exportData.metadata.channelName} (${channelId})`)
    console.log(`- Guild: ${exportData.metadata.guildName}`)
    console.log(`- Messages exported: ${messages.length}`)
    console.log(`- Date range: ${exportData.metadata.dateRange.earliest} to ${exportData.metadata.dateRange.latest}`)
    console.log(`- Output file: ${outputFile}`)
    console.log(`- File size: ${fileSizeMB} MB`)
    console.log('✅ Export completed successfully')

  } catch (error) {
    console.error('❌ Fatal error during export:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  exportMessages()
}

module.exports = exportMessages