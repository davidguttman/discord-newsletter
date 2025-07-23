#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Message = require('./models/message')
const { formatMessagesAsText } = require('./lib/message-formatter')
const openai = require('./lib/openai')
const { TOPIC_EXTRACTION_PROMPT } = require('./lib/openai/newspaper-prompts')
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

// Step 2: Extract topics from message map
async function step2_extractTopics(runDir) {
  console.log('\n📝 STEP 2: Extracting Topics')
  console.log('='.repeat(60))
  
  // Load message map from step 1
  const mapFile = path.join(runDir, 'step1-output-message-map.txt')
  if (!fs.existsSync(mapFile)) {
    throw new Error('step1-output-message-map.txt not found. Run step 1 first.')
  }
  
  const messageMap = fs.readFileSync(mapFile, 'utf8')
  console.log(`📥 Loaded message map (${messageMap.split('\n').length} lines)`)
  
  // Create prompt with message map
  const prompt = TOPIC_EXTRACTION_PROMPT.replace('{messages}', messageMap)
  
  // Save the prompt template used
  const promptFile = path.join(runDir, 'step2-prompt-template.txt')
  fs.writeFileSync(promptFile, prompt)
  console.log(`💾 Saved prompt template to ${promptFile}`)
  
  // Call OpenRouter for topic extraction
  console.log('🤖 Extracting topics with LLM...')
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
  
  const topicsText = response.choices[0].message.content
  
  // Parse JSON from response (handle markdown code blocks if present)
  let topics
  try {
    const jsonMatch = topicsText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const jsonText = jsonMatch ? jsonMatch[1] : topicsText
    topics = JSON.parse(jsonText)
  } catch (error) {
    console.error('Failed to parse JSON response:', topicsText)
    throw new Error('Invalid JSON response from LLM')
  }
  
  // Save extracted topics
  const topicsFile = path.join(runDir, 'step2-output-topics.json')
  fs.writeFileSync(topicsFile, JSON.stringify(topics, null, 2))
  console.log(`💾 Saved topics to ${topicsFile}`)
  console.log(`🎯 Found ${topics.topics.length} topics`)
  
  // Save raw LLM response
  const rawResponseFile = path.join(runDir, 'step2-raw-response.txt')
  fs.writeFileSync(rawResponseFile, topicsText)
  console.log(`💾 Saved raw response to ${rawResponseFile}`)
  
  // Save metadata
  const metadata = {
    step: 2,
    timestamp: new Date().toISOString(),
    model: 'google/gemini-2.5-flash-lite',
    topics_count: topics.topics.length,
    usage: response.usage,
    output_files: {
      topics: 'step2-output-topics.json',
      raw_response: 'step2-raw-response.txt',
      prompt_template: 'step2-prompt-template.txt'
    }
  }
  
  const metadataFile = path.join(runDir, 'step2-metadata.json')
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  
  console.log('✅ Step 2 complete')
  return topics
}

// Main workflow runner
async function runWorkflow() {
  const options = parseArgs()
  
  if (!options.step) {
    console.log('Usage: node newspaper-workflow.js --run <name> --step <1|2|all>')
    console.log('   or: node newspaper-workflow.js --step <1|2|all> (uses latest run)')
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
      await step2_extractTopics(runDir)
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

module.exports = { step1_loadMessages, step2_extractTopics }