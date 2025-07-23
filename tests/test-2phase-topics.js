#!/usr/bin/env node

const fs = require('fs')
const OpenAI = require('openai')
const config = require('../config')
const { buildMessageMap } = require('../lib/message-formatter')

// Initialize OpenRouter client
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openrouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://discord-newsletter.local',
    'X-Title': 'Discord Newsletter Pipeline',
  },
})

// Load messages and use the REAL message mapping system
function loadMessagesWithMapping() {
  const content = fs.readFileSync('channel-messages-sample.txt', 'utf8')
  const messages = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const match = line.match(/^\[(.+?)\] ([^:]+): (.+)$/)
    if (match) {
      const [, timestamp, username, content] = match
      const messageObj = {
        id: `msg_${messages.length}`,
        content: content === '[no text content]' ? '' : content,
        authorId: `user_${username}`,
        authorUsername: username,
        channelId: 'sample_channel',
        createdAt: new Date(timestamp).toISOString(),
        updatedAt: new Date(timestamp).toISOString(),
        // No thread/reply data in our sample, but structure is ready
        threadId: null,
        replyToId: null,
        attachments: [],
        embeds: []
      }
      messages.push(messageObj)
    }
  }
  
  console.log(`📄 Loaded ${messages.length} messages from channel-messages-sample.txt`)
  
  // Use the REAL message mapping system
  const { messageMap, threadMap, rootMessages } = buildMessageMap(messages)
  
  console.log(`🗺️  Built message map: ${messageMap.size} messages, ${threadMap.size} threads, ${rootMessages.length} root messages`)
  
  // Save the message map to file for inspection
  const messageMapData = {
    metadata: {
      totalMessages: messageMap.size,
      totalThreads: threadMap.size,
      rootMessagesCount: rootMessages.length,
      timestamp: new Date().toISOString()
    },
    messageMap: Object.fromEntries(messageMap),
    threadMap: Object.fromEntries(threadMap),
    rootMessages: rootMessages
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const mapFilename = `outputs/${timestamp}-message-map.json`
  fs.writeFileSync(mapFilename, JSON.stringify(messageMapData, null, 2))
  console.log(`💾 Saved message map to ${mapFilename}`)
  
  return { 
    messages: Array.from(messageMap.values()),
    messageMap, 
    threadMap, 
    rootMessages 
  }
}

// Legacy function for backward compatibility  
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

const PHASE_1_TOPICS_PROMPT = `Analyze these Discord messages and create a list of distinct topics or discussion areas.

Requirements:
- Each topic should represent a unique conversation thread or subject area
- Topics can be broad (e.g., "AI Tools Discussion") or specific (e.g., "Kimi vs Claude Performance")
- Create as many topics as needed to properly categorize the content - no artificial limits
- Always include "misc" as the final topic for messages that don't fit elsewhere
- Focus on natural groupings that emerge from the actual discussions

Discord Messages:
{messages}

Return JSON with topic list:
{
  "topics": [
    "AI Tools Discussion",
    "Link Sharing", 
    "Programming Languages",
    "Community Events",
    "Technical Issues",
    "misc"
  ]
}`

const PHASE_2_ASSIGNMENT_PROMPT = `You are assigning Discord messages to topic categories.

Topic List:
{topics}

Task: For each message below, assign it to the BEST topic from the list. If the message doesn't clearly fit any topic, assign it to "misc".

Requirements:
- Each message gets exactly ONE topic assignment
- Choose the most relevant topic for each message
- Use "misc" for casual chat, acknowledgments, or unclear content

Discord Messages:
{messages}

Return JSON format:
{
  "assignments": [
    {
      "id": "msg_0", 
      "topic": "AI Tools Discussion"
    }
  ]
}`

async function runPhase1Topics(messages) {
  console.log('\n📝 PHASE 1: Generating Topic List')
  console.log('='.repeat(50))
  
  // Format messages for the prompt
  const messageText = messages.map(msg => 
    `${msg.id}: [${msg.createdAt}] ${msg.authorUsername}: ${msg.content}`
  ).join('\n')
  
  const prompt = PHASE_1_TOPICS_PROMPT.replace('{messages}', messageText)
  
  console.log(`🤖 Sending ${messages.length} messages to AI for topic generation...`)
  
  const response = await openai.chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      {
        role: 'system',
        content: 'You are a topic organizer. Return only valid JSON with a topic list.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 4000
  })

  const rawResponse = response.choices[0].message.content.trim()
  
  try {
    // Extract JSON from markdown code blocks if present  
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : rawResponse
    
    const result = JSON.parse(jsonText)
    
    console.log(`✅ Generated ${result.topics?.length || 0} topics`)
    result.topics?.forEach((topic, i) => {
      console.log(`  ${i + 1}. ${topic}`)
    })
    
    return result.topics || []
    
  } catch (error) {
    console.error('Failed to parse phase 1 response:', error.message)
    console.error('Raw response:', rawResponse.substring(0, 500))
    throw error
  }
}

async function runPhase2Assignment(messages, topics) {
  console.log('\n🏷️  PHASE 2: Assigning Messages to Topics')
  console.log('='.repeat(50))
  
  // Format messages and topics for the prompt
  const messageText = messages.map(msg => 
    `${msg.id}: [${msg.createdAt}] ${msg.authorUsername}: ${msg.content}`
  ).join('\n')
  
  const topicsText = topics.map((topic, i) => `${i + 1}. ${topic}`).join('\n')
  
  const prompt = PHASE_2_ASSIGNMENT_PROMPT
    .replace('{topics}', topicsText)
    .replace('{messages}', messageText)
  
  console.log(`🤖 Assigning ${messages.length} messages to ${topics.length} topics...`)
  
  const response = await openai.chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      {
        role: 'system',
        content: 'You are a message categorizer. Return only valid JSON with message assignments.'
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
    
    console.log(`✅ Assigned ${result.assignments?.length || 0} messages`)
    
    // Show assignment summary
    const topicCounts = {}
    result.assignments?.forEach(assignment => {
      topicCounts[assignment.topic] = (topicCounts[assignment.topic] || 0) + 1
    })
    
    console.log('\n📊 Assignment Summary:')
    Object.entries(topicCounts).sort().forEach(([topic, count]) => {
      console.log(`  ${topic}: ${count} messages`)
    })
    
    return result.assignments || []
    
  } catch (error) {
    console.error('Failed to parse phase 2 response:', error.message)
    console.error('Raw response length:', rawResponse.length)
    console.error('Raw response (first 1000 chars):', rawResponse.substring(0, 1000))
    
    // Save raw response for debugging
    fs.writeFileSync('outputs/debug-phase2-raw.txt', rawResponse)
    console.log('💾 Saved raw response to outputs/debug-phase2-raw.txt')
    
    throw error
  }
}

function saveResults(topics, assignments, originalMessages) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `outputs/${timestamp}-2phase-results.json`
  
  // Group assignments by topic with full message content
  const topicGroups = {}
  topics.forEach(topic => {
    topicGroups[topic] = []
  })
  
  assignments.forEach(assignment => {
    const fullMessage = originalMessages.find(msg => msg.id === assignment.id)
    if (fullMessage && topicGroups[assignment.topic]) {
      topicGroups[assignment.topic].push({
        id: fullMessage.id,
        timestamp: fullMessage.createdAt,
        username: fullMessage.authorUsername,
        content: fullMessage.content
      })
    }
  })
  
  const result = {
    phase1_topics: topics,
    phase2_assignments: assignments, // Keep original for compatibility
    topic_groups: topicGroups,       // New: grouped by topic with full content
    metadata: {
      model: 'google/gemini-2.5-flash-lite',
      provider: 'openrouter',
      timestamp: new Date().toISOString(),
      total_messages: originalMessages.length,
      total_topics: topics.length
    }
  }
  
  fs.writeFileSync(filename, JSON.stringify(result, null, 2))
  console.log(`💾 Saved results to ${filename}`)
  
  return filename
}

async function main() {
  console.log('🧪 2-PHASE TOPIC ASSIGNMENT TEST WITH REAL MESSAGE MAPPING')
  console.log('='.repeat(60))
  
  try {
    // Step 1: Load messages with REAL message mapping
    const { messages, messageMap, threadMap, rootMessages } = loadMessagesWithMapping()
    
    // Step 2: Phase 1 - Generate topic list
    const topics = await runPhase1Topics(messages)
    
    // Step 3: Phase 2 - Assign messages to topics
    const assignments = await runPhase2Assignment(messages, topics)
    
    // Step 4: Save results with full message content
    const filename = saveResults(topics, assignments, messages)
    
    console.log(`\n🎉 2-phase assignment complete! Results saved to ${filename}`)
    
  } catch (error) {
    console.error('❌ 2-phase assignment failed:', error.message)
    throw error
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { loadMessagesWithMapping, loadAndMapMessages, runPhase1Topics, runPhase2Assignment }