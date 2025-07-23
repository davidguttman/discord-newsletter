const { Configuration, OpenAIApi } = require('openai')
const config = require('../../config')
const { TOPIC_EXTRACTION_PROMPT, FOCUSED_STORY_PROMPT, NEWSPAPER_ASSEMBLY_PROMPT } = require('./newspaper-prompts')

// Initialize OpenAI client on startup
if (!config.openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

const configuration = new Configuration({
  apiKey: config.openaiApiKey
})

const openai = new OpenAIApi(configuration)

// Generate summary for given messages using multi-pass approach ONLY
async function summarizeMessages (messages, options = {}) {
  const model = options.model || config.openaiModel
  const maxTokens = options.maxTokens || config.openaiMaxTokens

  try {
    return await generateMultiPassSummary(messages, model, maxTokens, options)
  } catch (error) {
    console.error('Error generating summary:', error)
    throw error
  }
}

// Multi-pass newspaper generation
async function generateMultiPassSummary (messages, model, maxTokens, options = {}) {
  const debugSteps = []
  const log = (message, step = null) => {
    console.log(message)
    if (options.debug) {
      debugSteps.push({ message, step, timestamp: new Date() })
    }
  }

  log('🔄 Starting multi-pass summary generation...', 'initialization')

  // Pass 1: Extract topics
  log('📝 Pass 1: Extracting topics...', 'topic-extraction-start')

  const topicsResponse = await openai.createChatCompletion({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing Discord conversations and identifying distinct topics.'
      },
      {
        role: 'user',
        content: TOPIC_EXTRACTION_PROMPT.replace('{messages}', messages)
      }
    ],
    max_tokens: 1000,
    response_format: { type: "json_object" } // Force JSON output
  })

  let rawResponse = topicsResponse.data.choices[0].message.content
  log(`📥 Raw topic extraction response: ${rawResponse.substring(0, 200)}...`, 'raw-response')
  
  let topics
  try {
    const parsedResponse = JSON.parse(rawResponse)
    topics = parsedResponse.topics || []
  } catch (parseError) {
    log(`⚠️ JSON parsing failed: ${parseError.message}. Retrying with JSON fix prompt...`, 'json-parse-error')
    
    // Retry with a JSON fix prompt
    const fixResponse = await openai.createChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: 'Fix the following text to be valid JSON format only. Return only the corrected JSON, no other text.'
        },
        {
          role: 'user',
          content: `Fix this to valid JSON:\n${rawResponse}`
        }
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })
    
    try {
      const fixedResponse = fixResponse.data.choices[0].message.content
      log(`📥 Fixed JSON response: ${fixedResponse.substring(0, 200)}...`, 'json-fixed')
      const parsedResponse = JSON.parse(fixedResponse)
      topics = parsedResponse.topics || []
    } catch (secondError) {
      log(`⚠️ JSON fix also failed: ${secondError.message}. Creating single general topic.`, 'json-fix-failed')
      // Create a single general topic if both attempts fail
      topics = [{
        id: 'general-discussion',
        description: 'General channel discussion and activity',
        substance: 3,
        category: 'general'
      }]
    }
  }
  
  // If no substantial topics found, create a general one
  const substantialTopics = topics.filter(t => t.substance >= 2)
  if (substantialTopics.length === 0) {
    log(`📝 No substantial topics found, creating general topic`, 'no-substantial-topics')
    topics = [{
      id: 'general-discussion',
      description: 'General channel discussion and activity',
      substance: 3,
      category: 'general'
    }]
  } else {
    topics = substantialTopics
  }
  
  log(`📊 Found ${topics.length} topics: ${topics.map(t => t.description).join(', ')}`, 'topics-extracted')

  // Pass 2: Generate story for each substantial topic
  log('✍️ Pass 2: Generating individual stories...', 'story-generation-start')
  const stories = []
  const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // Add usage from topic extraction
  totalUsage.prompt_tokens += topicsResponse.data.usage.prompt_tokens
  totalUsage.completion_tokens += topicsResponse.data.usage.completion_tokens
  totalUsage.total_tokens += topicsResponse.data.usage.total_tokens

  for (const topic of topics) {
    if (topic.substance >= 2) { // Only substantial discussions
      log(`  📰 Writing story: ${topic.description}`, 'story-generation')

      const storyPrompt = FOCUSED_STORY_PROMPT
        .replace('{topicDescription}', topic.description)
        .replace('{category}', topic.category || 'discussion')
        .replace('{messages}', messages)
        .replace('{channelName}', 'channel') // We'll need to pass this in later

      const storyResponse = await openai.createChatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a tech journalist writing focused news stories for "The Daily Discord Times".'
          },
          {
            role: 'user',
            content: storyPrompt
          }
        ],
        max_tokens: Math.floor(maxTokens / Math.max(topics.length, 1))
      })

      stories.push({
        topic,
        content: storyResponse.data.choices[0].message.content
      })

      // Add to usage tracking
      totalUsage.prompt_tokens += storyResponse.data.usage.prompt_tokens
      totalUsage.completion_tokens += storyResponse.data.usage.completion_tokens
      totalUsage.total_tokens += storyResponse.data.usage.total_tokens
    }
  }

  // Pass 3: Assemble final newspaper
  log('📰 Pass 3: Assembling final newspaper...', 'assembly-start')
  const storiesContent = stories.map(s => s.content).join('\n\n')

  const assemblyPrompt = NEWSPAPER_ASSEMBLY_PROMPT
    .replace('{stories}', storiesContent)
    .replace('{channelName}', 'channel')

  const finalResponse = await openai.createChatCompletion({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are the editor-in-chief of "The Daily Discord Times", assembling the final newspaper.'
      },
      {
        role: 'user',
        content: assemblyPrompt
      }
    ],
    max_tokens: maxTokens
  })

  // Add final usage
  totalUsage.prompt_tokens += finalResponse.data.usage.prompt_tokens
  totalUsage.completion_tokens += finalResponse.data.usage.completion_tokens
  totalUsage.total_tokens += finalResponse.data.usage.total_tokens

  log(`✅ Multi-pass complete. Generated ${stories.length} stories using ${totalUsage.total_tokens} tokens`, 'complete')

  const result = {
    summary: finalResponse.data.choices[0].message.content,
    usage: totalUsage,
    metadata: {
      approach: 'multi-pass',
      topicsFound: topics.length,
      storiesGenerated: stories.length,
      topics: topics.map(t => ({ description: t.description, substance: t.substance }))
    }
  }

  if (options.debug) {
    result.debugSteps = debugSteps
  }

  return result
}

// Single-pass newspaper generation (fallback)
async function generateSinglePassSummary (messages, model, maxTokens) {
  console.log('📝 Using single-pass summary generation')

  const response = await openai.createChatCompletion({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a tech journalist writing for "The Daily Discord Times". You write engaging news articles with headlines, quotes, and preserve all links mentioned.'
      },
      {
        role: 'user',
        content: `Write a newspaper-style article about what happened in this Discord channel today.

FORMAT:
## [Compelling Headline]
*From #{channelName}*

[2-3 paragraph news story with direct quotes and context]

REQUIREMENTS:
- Use ACTUAL usernames and EXACT quotes from the messages
- Write like real journalism with engaging headlines  
- Include every URL, GitHub repo, tool, or resource mentioned
- Format links as [descriptive text](url)
- Quote format: "exact quote," said username
- Vary length based on activity (2 sentences to 3 paragraphs)
- Focus on technical discussions, tools, and community activity
- No fluff - just report what happened

At the end, add a resources section:

---

## 📚 Resources Mentioned
- [Link Title](url) - Brief description

Raw Messages:
${messages}`
      }
    ],
    max_tokens: maxTokens
  })

  return {
    summary: response.data.choices[0].message.content,
    usage: response.data.usage,
    metadata: {
      approach: 'single-pass'
    }
  }
}

module.exports = {
  summarizeMessages
}
