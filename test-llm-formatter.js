#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { formatMessagesLLM } = require('./lib/message-formatter-llm')

// Load the exported messages
console.log('📥 Loading messages from data/channel-1209303473263485011.json...')
const exportData = JSON.parse(fs.readFileSync('data/channel-1209303473263485011.json', 'utf8'))
const allMessages = exportData.messages

console.log(`✅ Loaded ${allMessages.length} total messages`)
console.log(`📅 Date range: ${exportData.metadata.dateRange.earliest} to ${exportData.metadata.dateRange.latest}`)

// Filter for last two days of the dataset (not current time)
const latestMessageDate = new Date(Math.max(...allMessages.map(msg => new Date(msg.createdAt))))
const twoDaysAgo = new Date(latestMessageDate.getTime() - (2 * 24 * 60 * 60 * 1000))

console.log(`\n🔍 Filtering for messages from last 2 days of dataset (since ${twoDaysAgo.toISOString()})...`)
console.log(`📅 Latest message in dataset: ${latestMessageDate.toISOString()}`)

const recentMessages = allMessages.filter(msg => {
  const msgDate = new Date(msg.createdAt)
  return msgDate >= twoDaysAgo
})

console.log(`✅ Found ${recentMessages.length} messages from last 2 days`)

if (recentMessages.length === 0) {
  console.log('❌ No recent messages found')
  process.exit(0)
}

// Apply LLM formatter
console.log('\n🔄 Applying LLM formatter with flattened reply chains...')
const formattedConversations = formatMessagesLLM(recentMessages)

const conversationIds = Object.keys(formattedConversations)
console.log(`✅ Created ${conversationIds.length} conversation groups`)

// Show summary
console.log('\n📊 Conversation Summary:')
conversationIds.forEach((rootId, index) => {
  const conv = formattedConversations[rootId]
  const replyCount = Object.keys(conv.replies).length
  const threadCount = Object.keys(conv.threadMessages).length

  console.log(`  ${index + 1}. Root: ${conv.rootMessage.authorUsername} (${replyCount} replies, ${threadCount} thread msgs)`)
  console.log(`     Content: "${conv.rootMessage.content.substring(0, 80)}${conv.rootMessage.content.length > 80 ? '...' : ''}"`)
})

// Save to file
const outputFile = 'test-llm-formatted-conversations.json'
console.log(`\n💾 Saving formatted conversations to ${outputFile}...`)
fs.writeFileSync(outputFile, JSON.stringify(formattedConversations, null, 2))

const stats = fs.statSync(outputFile)
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

console.log(`✅ Saved ${conversationIds.length} conversations (${fileSizeMB} MB)`)
console.log('\n🎉 LLM formatting test complete!')

// Show a detailed example
if (conversationIds.length > 0) {
  console.log('\n📋 Example conversation structure:')
  const exampleId = conversationIds[0]
  const example = formattedConversations[exampleId]

  console.log(`Root message (${example.rootMessage.id}):`)
  console.log(`  Author: ${example.rootMessage.authorUsername}`)
  console.log(`  Content: ${example.rootMessage.content}`)
  console.log(`  Replies: ${Object.keys(example.replies).length}`)
  console.log(`  Thread messages: ${Object.keys(example.threadMessages).length}`)

  if (Object.keys(example.replies).length > 0) {
    console.log('\nFlattened replies:')
    Object.entries(example.replies).forEach(([replyId, reply]) => {
      console.log(`  - ${reply.authorUsername}: "${reply.content.substring(0, 60)}${reply.content.length > 60 ? '...' : ''}"`)
    })
  }
}
