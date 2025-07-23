#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Message = require('./models/message')
const { formatMessagesAsText } = require('./lib/message-formatter')
const openai = require('./lib/openai')
const { MESSAGE_GROUPING_PROMPT, STORY_WRITING_PROMPT } = require('./lib/openai/newspaper-prompts')
const OpenAI = require('openai')
const config = require('./config')

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    run: null,
    step: null
  }
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run' && args[i + 1]) {
      options.run = args[i + 1]
      i++
    } else if (args[i] === '--step' && args[i + 1]) {
      options.step = args[i + 1]
      i++
    }
  }
  
  return options
}

// Get or create run directory
function getRunDir(runName) {
  if (!runName) {
    // Auto-detect latest run directory
    const workflowDir = 'workflow-runs'
    if (!fs.existsSync(workflowDir)) {
      throw new Error('No workflow runs found. Please specify --run name')
    }
    
    const runs = fs.readdirSync(workflowDir).filter(f => 
      fs.statSync(path.join(workflowDir, f)).isDirectory()
    ).sort().reverse()
    
    if (runs.length === 0) {
      throw new Error('No workflow runs found. Please specify --run name')
    }
    
    runName = runs[0]
    console.log(`📁 Using latest run: ${runName}`)
  }
  
  const runDir = path.join('workflow-runs', runName)
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true })
    console.log(`📁 Created run directory: ${runDir}`)
  }
  
  return runDir
}

// Step 1: Load messages and create message map
async function step1_loadMessages(runDir) {
  console.log('\n📥 STEP 1: Loading Messages and Creating Map')
  console.log('='.repeat(60))
  
  // Get real Discord messages from database
  console.log('🔍 Loading messages from database...')
  const messages = await Message.find().sort({ createdAt: 1 }).limit(50)
  console.log(`✅ Found ${messages.length} messages`)
  
  if (messages.length === 0) {
    throw new Error('No messages found in database')
  }
  
  // Save raw messages
  const messagesFile = path.join(runDir, 'step1-input-messages.json')
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2))
  console.log(`💾 Saved raw messages to ${messagesFile}`)
  
  // Create message map with threading
  console.log('🗺️  Creating threaded message map...')
  const messageMap = formatMessagesAsText(messages)
  
  // Save message map
  const mapFile = path.join(runDir, 'step1-output-message-map.txt')
  fs.writeFileSync(mapFile, messageMap)
  console.log(`💾 Saved message map to ${mapFile}`)
  
  // Save metadata
  const metadata = {
    step: 1,
    timestamp: new Date().toISOString(),
    message_count: messages.length,
    output_files: {
      raw_messages: 'step1-input-messages.json',
      message_map: 'step1-output-message-map.txt'
    }
  }
  
  const metadataFile = path.join(runDir, 'step1-metadata.json')
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  
  console.log('✅ Step 1 complete')
  return { messageMap, messages }
}

// Step 2: Group messages into topics
async function step2_groupMessagesByTopic(runDir) {
  console.log('\n📝 STEP 2: Grouping Messages by Topic')
  console.log('='.repeat(60))
  
  // Load message map from step 1
  const mapFile = path.join(runDir, 'step1-output-message-map.txt')
  if (!fs.existsSync(mapFile)) {
    throw new Error('step1-output-message-map.txt not found. Run step 1 first.')
  }
  
  const messageMap = fs.readFileSync(mapFile, 'utf8')
  console.log(`📥 Loaded message map (${messageMap.split('\n').length} lines)`)
  
  // Create prompt with message map
  const prompt = MESSAGE_GROUPING_PROMPT.replace('{messages}', messageMap)
  
  // Save the prompt template used
  const promptFile = path.join(runDir, 'step2-prompt-template.txt')
  fs.writeFileSync(promptFile, prompt)
  console.log(`💾 Saved prompt template to ${promptFile}`)
  
  // Call OpenRouter for message grouping
  console.log('🤖 Grouping messages by topic with LLM...')
  const openrouterClient = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  })
  
  const response = await openrouterClient.chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1
  })
  
  const responseText = response.choices[0].message.content
  
  // Parse JSON from response (handle markdown code blocks if present)
  let messageGroups
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : responseText
    messageGroups = JSON.parse(jsonText)
  } catch (error) {
    console.error('Failed to parse JSON response:', responseText)
    throw new Error('Invalid JSON response from LLM')
  }
  
  // Save message groups
  const groupsFile = path.join(runDir, 'step2-output-message-groups.json')
  fs.writeFileSync(groupsFile, JSON.stringify(messageGroups, null, 2))
  console.log(`💾 Saved message groups to ${groupsFile}`)
  
  const topicCount = Object.keys(messageGroups.topic_groups).length
  const totalMessages = Object.values(messageGroups.topic_groups).reduce((sum, msgs) => sum + msgs.length, 0)
  console.log(`🎯 Created ${topicCount} topics with ${totalMessages} messages`)
  
  // Show topic summary
  Object.entries(messageGroups.topic_groups).forEach(([topic, messages]) => {
    console.log(`  📌 ${topic}: ${messages.length} messages`)
  })
  
  // Save raw LLM response
  const rawResponseFile = path.join(runDir, 'step2-raw-response.txt')
  fs.writeFileSync(rawResponseFile, responseText)
  console.log(`💾 Saved raw response to ${rawResponseFile}`)
  
  // Save metadata
  const metadata = {
    step: 2,
    timestamp: new Date().toISOString(),
    model: 'google/gemini-2.5-flash-lite',
    topic_count: topicCount,
    total_messages: totalMessages,
    usage: response.usage,
    output_files: {
      message_groups: 'step2-output-message-groups.json',
      raw_response: 'step2-raw-response.txt',
      prompt_template: 'step2-prompt-template.txt'
    }
  }
  
  const metadataFile = path.join(runDir, 'step2-metadata.json')
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  
  console.log('✅ Step 2 complete')
  return messageGroups
}

// Step 3: Write stories for each topic group
async function step3_writeStories(runDir) {
  console.log('\n📰 STEP 3: Writing Stories for Each Topic')
  console.log('='.repeat(60))
  
  // Load message groups from step 2
  const groupsFile = path.join(runDir, 'step2-output-message-groups.json')
  if (!fs.existsSync(groupsFile)) {
    throw new Error('step2-output-message-groups.json not found. Run step 2 first.')
  }
  
  const messageGroups = JSON.parse(fs.readFileSync(groupsFile, 'utf8'))
  const topicGroups = messageGroups.topic_groups
  
  console.log(`📥 Loaded ${Object.keys(topicGroups).length} topic groups`)
  
  const openrouterClient = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  })
  
  const stories = {}
  
  // Save the prompt template (same for all topics)
  const promptTemplateFile = path.join(runDir, 'step3-prompt-template.txt')
  fs.writeFileSync(promptTemplateFile, STORY_WRITING_PROMPT)
  console.log(`💾 Saved prompt template to ${promptTemplateFile}`)
  
  // Process all topic groups in parallel
  console.log(`\n🤖 Generating stories for all ${Object.keys(topicGroups).length} topics in parallel...`)
  
  const storyPromises = Object.entries(topicGroups).map(async ([topicName, messages]) => {
    console.log(`📝 Starting story for: ${topicName} (${messages.length} messages)`)
    
    // Format messages for the prompt
    const topicMessagesText = messages.map(msg => 
      `[${msg.timestamp}] ${msg.username}: ${msg.content}`
    ).join('\n')
    
    // Create prompt for this topic
    const prompt = STORY_WRITING_PROMPT
      .replace('{topicName}', topicName)
      .replace('{topicMessages}', topicMessagesText)
    
    // Generate story
    const response = await openrouterClient.chat.completions.create({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
    
    const story = response.choices[0].message.content.trim()
    console.log(`✅ Generated story for ${topicName} (${story.length} chars)`)
    
    return {
      topicName,
      story,
      message_count: messages.length,
      usage: response.usage
    }
  })
  
  // Wait for all stories to complete
  const storyResults = await Promise.all(storyPromises)
  
  // Convert results to stories object
  storyResults.forEach(result => {
    stories[result.topicName] = {
      story: result.story,
      message_count: result.message_count,
      usage: result.usage
    }
  })
  
  // Save all stories
  const storiesFile = path.join(runDir, 'step3-output-stories.json')
  fs.writeFileSync(storiesFile, JSON.stringify(stories, null, 2))
  console.log(`\n💾 Saved all stories to ${storiesFile}`)
  
  // Prompt template already saved above
  
  // Create combined newspaper format
  const newspaperContent = Object.entries(stories)
    .map(([topicName, storyData]) => storyData.story)
    .join('\n\n---\n\n')
  
  const newspaperFile = path.join(runDir, 'step3-output-newspaper.md')
  fs.writeFileSync(newspaperFile, newspaperContent)
  console.log(`💾 Saved combined newspaper to ${newspaperFile}`)
  
  // Save metadata
  const totalUsage = Object.values(stories).reduce((acc, story) => ({
    prompt_tokens: (acc.prompt_tokens || 0) + (story.usage?.prompt_tokens || 0),
    completion_tokens: (acc.completion_tokens || 0) + (story.usage?.completion_tokens || 0),
    total_tokens: (acc.total_tokens || 0) + (story.usage?.total_tokens || 0)
  }), {})
  
  const metadata = {
    step: 3,
    timestamp: new Date().toISOString(),
    model: 'google/gemini-2.5-flash-lite',
    topic_count: Object.keys(stories).length,
    total_stories: Object.keys(stories).length,
    usage: totalUsage,
    output_files: {
      stories: 'step3-output-stories.json',
      newspaper: 'step3-output-newspaper.md',
      prompt_template: 'step3-prompt-template.txt'
    }
  }
  
  const metadataFile = path.join(runDir, 'step3-metadata.json')
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  
  console.log(`\n✅ Step 3 complete - Generated ${Object.keys(stories).length} stories`)
  return stories
}

// Main workflow runner
async function runWorkflow() {
  const options = parseArgs()
  
  if (!options.step) {
    console.log('Usage: node newspaper-workflow.js --run <name> --step <1|2|3|all>')
    console.log('   or: node newspaper-workflow.js --step <1|2|3|all> (uses latest run)')
    process.exit(1)
  }
  
  try {
    const runDir = getRunDir(options.run)
    
    console.log('🚀 NEWSPAPER WORKFLOW')
    console.log('='.repeat(60))
    console.log(`📁 Run: ${path.basename(runDir)}`)
    console.log(`🎯 Step: ${options.step}`)
    console.log('')
    
    if (options.step === '1' || options.step === 'all') {
      await step1_loadMessages(runDir)
    }
    
    if (options.step === '2' || options.step === 'all') {
      await step2_groupMessagesByTopic(runDir)
    }
    
    if (options.step === '3' || options.step === 'all') {
      await step3_writeStories(runDir)
    }
    
    console.log('\n🎉 WORKFLOW COMPLETE!')
    console.log(`📁 All outputs saved to: ${runDir}`)
    
  } catch (error) {
    console.error('❌ Workflow failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  runWorkflow().catch(console.error)
}

module.exports = { step1_loadMessages, step2_groupMessagesByTopic, step3_writeStories }