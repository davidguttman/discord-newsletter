#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const messageFormatter = require('./lib/message-formatter')
const openai = require('./lib/openai')

// Parse messages from the sample text file
function loadSampleMessages() {
  const filePath = path.join(__dirname, 'channel-messages-sample.txt')
  const content = fs.readFileSync(filePath, 'utf8')
  
  const messages = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const match = line.match(/^\[(.+?)\] ([^:]+): (.+)$/)
    if (match) {
      const [, timestamp, username, content] = match
      messages.push({
        id: `msg_${messages.length}`,
        content: content === '[no text content]' ? '' : content,
        authorUsername: username,
        authorId: `user_${username}`,
        channelId: '1209303473263485011',
        channelName: 'technology-trends',
        guildId: '822583790773862470',
        createdAt: new Date(timestamp),
        attachments: [],
        embeds: [],
        threadId: null,
        replyToId: null,
        mentionsReplyTarget: false
      })
    }
  }
  
  console.log(`📄 Loaded ${messages.length} messages from sample file`)
  return messages
}

// Test stages
class NewspaperPipelineTester {
  constructor(messages) {
    this.messages = messages
    this.formattedMessages = null
    this.summaryResult = null
  }

  // Stage 1: Message Formatting
  async formatMessages() {
    console.log('\n🔄 STAGE 1: Message Formatting')
    console.log('='.repeat(50))
    
    this.formattedMessages = messageFormatter.formatMessages(this.messages, { format: 'txt' })
    
    console.log(`📝 Formatted ${this.messages.length} messages into text`)
    console.log('📄 Sample formatted output:')
    console.log(this.formattedMessages.substring(0, 300) + '...')
    
    return this.formattedMessages
  }

  // Stage 2: Full OpenAI Processing (multi-pass with debug)
  async processWithOpenAI(options = {}) {
    console.log('\n🤖 STAGE 2: OpenAI Multi-Pass Processing')
    console.log('='.repeat(50))
    
    if (!this.formattedMessages) {
      await this.formatMessages()
    }
    
    const openaiOptions = {
      debug: true,
      ...options
    }
    
    console.log('🔄 Starting multi-pass newspaper generation...')
    this.summaryResult = await openai.summarizeMessages(this.formattedMessages, openaiOptions)
    
    console.log('✅ Processing complete!')
    console.log(`📊 Metadata:`, JSON.stringify(this.summaryResult.metadata, null, 2))
    
    if (this.summaryResult.debugSteps) {
      console.log('\n📋 Debug Steps:')
      this.summaryResult.debugSteps.forEach((step, i) => {
        console.log(`  ${i+1}. [${step.step}] ${step.message}`)
      })
    }
    
    return this.summaryResult
  }

  // View final summary
  showFinalSummary() {
    if (!this.summaryResult) {
      console.log('❌ No summary result available. Run processWithOpenAI() first.')
      return
    }

    console.log('\n📰 FINAL NEWSPAPER SUMMARY')
    console.log('='.repeat(50))
    console.log(this.summaryResult.summary)
    console.log('\n📈 Usage:', this.summaryResult.usage)
  }

  // Analyze for duplicates
  analyzeDuplicates() {
    if (!this.summaryResult) {
      console.log('❌ No summary result available. Run processWithOpenAI() first.')
      return
    }

    console.log('\n🔍 DUPLICATE ANALYSIS')
    console.log('='.repeat(50))
    
    const summary = this.summaryResult.summary
    const urls = summary.match(/(https?:\/\/[^\s\])]+)/g) || []
    const urlCounts = {}
    
    urls.forEach(url => {
      urlCounts[url] = (urlCounts[url] || 0) + 1
    })
    
    console.log(`📖 Total URLs found: ${urls.length}`)
    console.log(`🔗 Unique URLs: ${Object.keys(urlCounts).length}`)
    
    const duplicates = Object.entries(urlCounts).filter(([url, count]) => count > 1)
    if (duplicates.length > 0) {
      console.log('❌ DUPLICATE URLs found:')
      duplicates.forEach(([url, count]) => {
        console.log(`  - ${url} (appears ${count} times)`)
      })
    } else {
      console.log('✅ No duplicate URLs found')
    }

    // Check for duplicate content patterns
    const topics = this.summaryResult.metadata.topics || []
    console.log(`\n📝 Topics extracted: ${topics.length}`)
    topics.forEach((topic, i) => {
      console.log(`  ${i+1}. ${topic.description} (substance: ${topic.substance})`)
    })
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'full'

  console.log('🧪 NEWSPAPER PIPELINE TESTER')
  console.log('Using existing app modules - no disjoint code!')
  
  try {
    const messages = loadSampleMessages()
    const tester = new NewspaperPipelineTester(messages)

    switch (command) {
      case 'format':
        await tester.formatMessages()
        break
        
      case 'openai':
        await tester.processWithOpenAI()
        tester.showFinalSummary()
        break
        
      case 'analyze':
        await tester.processWithOpenAI()
        tester.analyzeDuplicates()
        break
        
      case 'full':
        await tester.formatMessages()
        await tester.processWithOpenAI()
        tester.showFinalSummary()
        tester.analyzeDuplicates()
        break
        
      default:
        console.log('\nUsage:')
        console.log('  node test-newspaper-pipeline.js [command]')
        console.log('')
        console.log('Commands:')
        console.log('  format   - Test message formatting only')
        console.log('  openai   - Test OpenAI processing only')
        console.log('  analyze  - Run analysis on duplicates/topics')
        console.log('  full     - Run complete pipeline (default)')
    }
    
  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Export for programmatic use
module.exports = { NewspaperPipelineTester, loadSampleMessages }

// Run if called directly
if (require.main === module) {
  main()
}