#!/usr/bin/env node

const fs = require('fs')
const OpenAI = require('openai')
const config = require('./config')

// Initialize OpenRouter client
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openrouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://discord-newsletter.local',
    'X-Title': 'Discord Newsletter Pipeline',
  },
})

// Load and map messages from sample file
function loadAndMapMessages() {
  const content = fs.readFileSync('channel-messages-sample.txt', 'utf8')
  const messages = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const match = line.match(/^\[(.+?)\] ([^:]+): (.+)$/)
    if (match) {
      const [, timestamp, username, content] = match
      const messageObj = {
        id: `msg_${messages.length}`,
        timestamp,
        username,
        content: content === '[no text content]' ? '' : content,
        originalLine: line
      }
      messages.push(messageObj)
    }
  }
  
  console.log(`📄 Loaded and mapped ${messages.length} messages`)
  return messages
}

const BATCH_TAGGING_PROMPT = `You are analyzing Discord messages to add descriptive tags and then group them.

TASK: Process these messages through 3 stages:

STAGE 1: Tag each message with up to 3 relevant #tags
STAGE 2: Group messages by tags (messages can appear under multiple tags)  
STAGE 3: Assign each message to only its BEST tag (each message appears under exactly one tag)

Tags should be:
- Descriptive of the content (e.g., #tool-sharing, #question, #opinion, #link-sharing)
- Consistent across similar messages
- Specific enough to be useful for grouping

MESSAGES:
{messages}

Return your response in this EXACT JSON format:
{
  "stage1_tagged_messages": [
    {
      "id": "msg_0",
      "timestamp": "...",
      "username": "...", 
      "content": "...",
      "tags": ["#tag1", "#tag2"]
    }
  ],
  "stage2_tag_groups": {
    "#tag1": [
      {
        "id": "msg_0",
        "timestamp": "...",
        "username": "...",
        "content": "..."
      }
    ]
  },
  "stage3_final_assignments": {
    "#tag1": [
      {
        "id": "msg_0", 
        "timestamp": "...",
        "username": "...",
        "content": "..."
      }
    ]
  }
}`

async function processAllMessages(messages) {
  console.log('\n🏷️  BATCH TAGGING ALL MESSAGES')
  console.log('='.repeat(50))
  
  // Format messages for the prompt
  const messageText = messages.map(msg => 
    `${msg.id}: [${msg.timestamp}] ${msg.username}: ${msg.content}`
  ).join('\n')
  
  const prompt = BATCH_TAGGING_PROMPT.replace('{messages}', messageText)
  
  console.log(`🤖 Sending ${messages.length} messages to AI for batch processing...`)
  
  const response = await openai.chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      {
        role: 'system',
        content: 'You are a message tagger and organizer. Return only valid JSON with all three stages.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 16000
  })

  const rawResponse = response.choices[0].message.content.trim()
  
  try {
    // Extract JSON from markdown code blocks if present  
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : rawResponse
    
    const result = JSON.parse(jsonText)
    
    console.log(`✅ Processed ${result.stage1_tagged_messages?.length || 0} messages`)
    console.log(`📊 Stage 2 - Found ${Object.keys(result.stage2_tag_groups || {}).length} tags`)
    console.log(`🎯 Stage 3 - Final ${Object.keys(result.stage3_final_assignments || {}).length} tag assignments`)
    
    return {
      ...result,
      metadata: {
        model: 'google/gemini-2.5-flash-lite',
        provider: 'openrouter',
        usage: response.usage,
        raw_response: rawResponse.substring(0, 500) + '...' // truncated for storage
      }
    }
    
  } catch (error) {
    console.error('Failed to parse batch response:', error.message)
    console.error('Raw response length:', rawResponse.length)
    console.error('Raw response (first 1000 chars):', rawResponse.substring(0, 1000))
    console.error('Raw response (last 500 chars):', rawResponse.substring(rawResponse.length - 500))
    
    // Save the raw response for debugging
    fs.writeFileSync('debug-raw-response.txt', rawResponse)
    console.log('💾 Saved raw response to debug-raw-response.txt')
    
    throw error
  }
}

function displayResults(result) {
  console.log('\n📋 STAGE 1: Tagged Messages')
  console.log('='.repeat(50))
  result.stage1_tagged_messages.forEach(msg => {
    console.log(`${msg.id}: ${msg.username} - ${msg.tags.join(', ')}`)
  })
  
  console.log('\n📋 STAGE 2: Tag Groups (messages can appear multiple times)')
  console.log('='.repeat(50))
  Object.entries(result.stage2_tag_groups).forEach(([tag, messages]) => {
    console.log(`${tag}: ${messages.length} messages`)
    messages.forEach(msg => {
      console.log(`  - ${msg.id}: ${msg.username}`)
    })
  })
  
  console.log('\n📋 STAGE 3: Final Assignments (each message appears once)')
  console.log('='.repeat(50))
  Object.entries(result.stage3_final_assignments).forEach(([tag, messages]) => {
    console.log(`${tag}: ${messages.length} messages`)
    messages.forEach(msg => {
      console.log(`  - ${msg.id}: ${msg.username}`)
    })
  })
}

function saveResults(result) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${timestamp}-batch-tagging-results.json`
  
  fs.writeFileSync(filename, JSON.stringify(result, null, 2))
  console.log(`💾 Saved all results to ${filename}`)
  
  return filename
}

async function main() {
  console.log('🧪 BATCH MESSAGE TAGGING TEST')
  console.log('='.repeat(60))
  
  try {
    // Step 1: Load and map messages
    const messages = loadAndMapMessages()
    
    // Step 2: Process all messages in batch (3 stages in one call)
    const result = await processAllMessages(messages)
    
    // Step 3: Display results
    displayResults(result)
    
    // Step 4: Save results
    const filename = saveResults(result)
    
    console.log(`\n🎉 Batch tagging complete! Results saved to ${filename}`)
    
  } catch (error) {
    console.error('❌ Batch tagging failed:', error.message)
    throw error
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { loadAndMapMessages, processAllMessages }