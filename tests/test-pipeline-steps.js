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

// STEP 1: Load raw messages from sample file
function step1_loadMessages() {
  console.log('\n📥 STEP 1: Loading Messages')
  console.log('='.repeat(50))
  
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
        threadId: null,
        replyToId: null,
        attachments: [],
        embeds: []
      }
      messages.push(messageObj)
    }
  }
  
  console.log(`✅ Loaded ${messages.length} raw messages`)
  
  // Save step 1 output
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `outputs/${timestamp}-step1-messages.json`
  fs.writeFileSync(filename, JSON.stringify({ messages, metadata: { step: 1, count: messages.length } }, null, 2))
  console.log(`💾 Saved to ${filename}`)
  
  return { messages, filename }
}

// STEP 2: Build message map with thread/reply relationships
function step2_buildMessageMap(messages) {
  console.log('\n🗺️  STEP 2: Building Message Map')
  console.log('='.repeat(50))
  
  const { messageMap, threadMap, rootMessages } = buildMessageMap(messages)
  
  console.log(`✅ Built message map: ${messageMap.size} messages, ${threadMap.size} threads, ${rootMessages.length} root messages`)
  
  // Save step 2 output
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `outputs/${timestamp}-step2-message-map.json`
  
  const messageMapData = {
    metadata: {
      step: 2,
      totalMessages: messageMap.size,
      totalThreads: threadMap.size,
      rootMessagesCount: rootMessages.length,
      timestamp: new Date().toISOString()
    },
    messageMap: Object.fromEntries(messageMap),
    threadMap: Object.fromEntries(threadMap),
    rootMessages: rootMessages
  }
  
  fs.writeFileSync(filename, JSON.stringify(messageMapData, null, 2))
  console.log(`💾 Saved to ${filename}`)
  
  return { 
    messages: Array.from(messageMap.values()),
    messageMap, 
    threadMap, 
    rootMessages,
    filename 
  }
}

// STEP 3: LLM Phase 1 - Generate topic list
async function step3_generateTopics(messages) {
  console.log('\n📝 STEP 3: LLM Phase 1 - Topic Generation')
  console.log('='.repeat(50))
  
  const messageText = messages.map(msg => 
    `${msg.id}: [${msg.createdAt}] ${msg.authorUsername}: ${msg.content}`
  ).join('\n')
  
  const prompt = `Analyze these Discord messages and create a list of distinct topics or discussion areas.

Requirements:
- Each topic should represent a unique conversation thread or subject area
- Topics can be broad (e.g., "AI Tools Discussion") or specific (e.g., "Kimi vs Claude Performance")
- Create as many topics as needed to properly categorize the content - no artificial limits
- Always include "misc" as the final topic for messages that don't fit elsewhere
- Focus on natural groupings that emerge from the actual discussions

Discord Messages:
${messageText}

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
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : rawResponse
    
    const result = JSON.parse(jsonText)
    const topics = result.topics || []
    
    console.log(`✅ Generated ${topics.length} topics`)
    topics.forEach((topic, i) => {
      console.log(`  ${i + 1}. ${topic}`)
    })
    
    // Save step 3 output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `outputs/${timestamp}-step3-topics.json`
    
    const stepData = {
      metadata: {
        step: 3,
        model: 'google/gemini-2.5-flash-lite',
        provider: 'openrouter',
        topicCount: topics.length,
        usage: response.usage,
        timestamp: new Date().toISOString()
      },
      topics: topics,
      raw_response: rawResponse.substring(0, 500) + '...'
    }
    
    fs.writeFileSync(filename, JSON.stringify(stepData, null, 2))
    console.log(`💾 Saved to ${filename}`)
    
    return { topics, filename }
    
  } catch (error) {
    console.error('Failed to parse topic generation response:', error.message)
    console.error('Raw response:', rawResponse.substring(0, 500))
    throw error
  }
}

// STEP 4: LLM Phase 2 - Assign messages to topics
async function step4_assignTopics(messages, topics) {
  console.log('\n🏷️  STEP 4: LLM Phase 2 - Topic Assignment')
  console.log('='.repeat(50))
  
  const messageText = messages.map(msg => 
    `${msg.id}: [${msg.createdAt}] ${msg.authorUsername}: ${msg.content}`
  ).join('\n')
  
  const topicsText = topics.map((topic, i) => `${i + 1}. ${topic}`).join('\n')
  
  const prompt = `You are assigning Discord messages to topic categories.

Topic List:
${topicsText}

Task: For each message below, assign it to the BEST topic from the list. If the message doesn't clearly fit any topic, assign it to "misc".

Requirements:
- Each message gets exactly ONE topic assignment
- Choose the most relevant topic for each message
- Use "misc" for casual chat, acknowledgments, or unclear content

Discord Messages:
${messageText}

Return JSON format:
{
  "assignments": [
    {
      "id": "msg_0", 
      "topic": "AI Tools Discussion"
    }
  ]
}`

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
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/```\s*([\s\S]*?)\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : rawResponse
    
    const result = JSON.parse(jsonText)
    const assignments = result.assignments || []
    
    console.log(`✅ Assigned ${assignments.length} messages`)
    
    // Show assignment summary
    const topicCounts = {}
    assignments.forEach(assignment => {
      topicCounts[assignment.topic] = (topicCounts[assignment.topic] || 0) + 1
    })
    
    console.log('\n📊 Assignment Summary:')
    Object.entries(topicCounts).sort().forEach(([topic, count]) => {
      console.log(`  ${topic}: ${count} messages`)
    })
    
    // Save step 4 output
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `outputs/${timestamp}-step4-assignments.json`
    
    const stepData = {
      metadata: {
        step: 4,
        model: 'google/gemini-2.5-flash-lite',
        provider: 'openrouter',
        assignmentCount: assignments.length,
        topicCounts: topicCounts,
        usage: response.usage,
        timestamp: new Date().toISOString()
      },
      assignments: assignments,
      raw_response: rawResponse.substring(0, 500) + '...'
    }
    
    fs.writeFileSync(filename, JSON.stringify(stepData, null, 2))
    console.log(`💾 Saved to ${filename}`)
    
    return { assignments, filename }
    
  } catch (error) {
    console.error('Failed to parse assignment response:', error.message)
    console.error('Raw response length:', rawResponse.length)
    console.error('Raw response (first 1000 chars):', rawResponse.substring(0, 1000))
    
    // Save raw response for debugging
    fs.writeFileSync('outputs/debug-step4-raw.txt', rawResponse)
    console.log('💾 Saved raw response to outputs/debug-step4-raw.txt')
    
    throw error
  }
}

// STEP 5: Generate final output with grouped messages
function step5_generateFinalOutput(messages, topics, assignments) {
  console.log('\n📋 STEP 5: Generating Final Output')
  console.log('='.repeat(50))
  
  // Group assignments by topic with full message content
  const topicGroups = {}
  topics.forEach(topic => {
    topicGroups[topic] = []
  })
  
  assignments.forEach(assignment => {
    const fullMessage = messages.find(msg => msg.id === assignment.id)
    if (fullMessage && topicGroups[assignment.topic]) {
      topicGroups[assignment.topic].push({
        id: fullMessage.id,
        timestamp: fullMessage.createdAt,
        username: fullMessage.authorUsername,
        content: fullMessage.content
      })
    }
  })
  
  console.log(`✅ Organized ${assignments.length} messages into ${topics.length} topic groups`)
  
  // Save step 5 output - final pipeline result
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `outputs/${timestamp}-step5-final-output.json`
  
  const finalResult = {
    metadata: {
      step: 5,
      pipeline_complete: true,
      total_messages: messages.length,
      total_topics: topics.length,
      total_assignments: assignments.length,
      timestamp: new Date().toISOString()
    },
    topics: topics,
    assignments: assignments,
    topic_groups: topicGroups
  }
  
  fs.writeFileSync(filename, JSON.stringify(finalResult, null, 2))
  console.log(`💾 Saved final output to ${filename}`)
  
  return { finalResult, filename }
}

// Main pipeline execution
async function runPipeline() {
  console.log('🚀 DISCORD MESSAGE PIPELINE')
  console.log('='.repeat(60))
  console.log('Pipeline: Messages → Map → Topics → Assignments → Output')
  console.log('')
  
  try {
    // Step 1: Load messages
    const step1Result = step1_loadMessages()
    
    // Step 2: Build message map
    const step2Result = step2_buildMessageMap(step1Result.messages)
    
    // Step 3: Generate topics
    const step3Result = await step3_generateTopics(step2Result.messages)
    
    // Step 4: Assign topics
    const step4Result = await step4_assignTopics(step2Result.messages, step3Result.topics)
    
    // Step 5: Generate final output
    const step5Result = step5_generateFinalOutput(step2Result.messages, step3Result.topics, step4Result.assignments)
    
    console.log('\n🎉 PIPELINE COMPLETE!')
    console.log('='.repeat(60))
    console.log(`📁 Step 1 (Messages): ${step1Result.filename}`)
    console.log(`📁 Step 2 (Map): ${step2Result.filename}`)
    console.log(`📁 Step 3 (Topics): ${step3Result.filename}`)
    console.log(`📁 Step 4 (Assignments): ${step4Result.filename}`)
    console.log(`📁 Step 5 (Final): ${step5Result.filename}`)
    
    return step5Result.finalResult
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message)
    throw error
  }
}

if (require.main === module) {
  runPipeline().catch(console.error)
}

module.exports = { 
  step1_loadMessages,
  step2_buildMessageMap, 
  step3_generateTopics,
  step4_assignTopics,
  step5_generateFinalOutput,
  runPipeline 
}