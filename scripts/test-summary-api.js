#!/usr/bin/env node

const ApiClient = require('../lib/api-client')

const GUILD_ID = '822583790773862470'
const CHANNEL_ID = '1209303473263485011'

async function testSummaryAPI () {
  console.log('🧪 Testing Summary API with ApiClient\n')

  // Create API client
  const api = new ApiClient('https://discnews.jump.sh')

  try {
    console.log('📋 Step 1: Checking for existing summary...')
    const existingSummary = await api.checkSummary(GUILD_ID, CHANNEL_ID, '24h')

    console.log(`   Message count: ${existingSummary.messageCount}`)
    console.log(`   Existing summary: ${existingSummary.summary ? 'YES' : 'NO'}`)

    if (existingSummary.summary) {
      console.log(`   Created at: ${existingSummary.createdAt}`)
      console.log(`   Summary preview: ${existingSummary.summary.substring(0, 100)}...`)
    }

    console.log('\n🤖 Step 2: Generating new summary (multi-pass)...')
    const newSummary = await api.generateSummary(GUILD_ID, CHANNEL_ID, '24h', { multiPass: true })

    console.log(`   Message count: ${newSummary.messageCount}`)
    console.log(`   Summary length: ${newSummary.summary.length} characters`)
    console.log(`   Tokens used: ${newSummary.usage.total_tokens}`)
    console.log(`   Created at: ${newSummary.createdAt}`)

    if (newSummary.metadata) {
      console.log(`   Approach: ${newSummary.metadata.approach}`)
      if (newSummary.metadata.topicsFound) {
        console.log(`   Topics found: ${newSummary.metadata.topicsFound}`)
        console.log(`   Stories generated: ${newSummary.metadata.storiesGenerated}`)
        console.log(`   Topics: ${newSummary.metadata.topics.map(t => t.description).join(', ')}`)
      }
    }

    console.log(`   Summary preview: ${newSummary.summary.substring(0, 200)}...`)

    console.log('\n🔄 Step 3: Checking for cached summary...')
    const cachedSummary = await api.checkSummary(GUILD_ID, CHANNEL_ID, '24h')

    console.log(`   Cached summary: ${cachedSummary.summary ? 'YES' : 'NO'}`)
    if (cachedSummary.summary) {
      console.log('   Cache hit! Summary is now available after generation')
      console.log(`   Created at: ${cachedSummary.createdAt}`)
    }

    console.log('\n✅ Summary API test completed successfully!')
  } catch (error) {
    console.error('❌ Summary API test failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testSummaryAPI()
}

module.exports = testSummaryAPI
