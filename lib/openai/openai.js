const OpenAI = require('openai')
const config = require('../../config')
const { TOPIC_EXTRACTION_PROMPT, FOCUSED_STORY_PROMPT, CATCHALL_STORY_PROMPT, LINK_COLLECTION_PROMPT } = require('./newspaper-prompts')

// Initialize OpenAI client on startup
if (!config.openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

const openai = new OpenAI({
  apiKey: config.openaiApiKey
})

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

  const topicsResponse = await openai.chat.completions.create({
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

  let rawResponse = topicsResponse.choices[0].message.content
  log(`📥 Raw topic extraction response: ${rawResponse.substring(0, 200)}...`, 'raw-response')
  
  let topics
  try {
    const parsedResponse = JSON.parse(rawResponse)
    topics = parsedResponse.topics || []
  } catch (parseError) {
    log(`⚠️ JSON parsing failed: ${parseError.message}. Retrying with JSON fix prompt...`, 'json-parse-error')
    
    // Retry with a JSON fix prompt
    const fixResponse = await openai.chat.completions.create({
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
      const fixedResponse = fixResponse.choices[0].message.content
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
  const substantialTopics = topics.filter(t => t.substance >= 1) // Lowered from 2 to 1
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
  totalUsage.prompt_tokens += topicsResponse.usage.prompt_tokens
  totalUsage.completion_tokens += topicsResponse.usage.completion_tokens
  totalUsage.total_tokens += topicsResponse.usage.total_tokens

  for (const topic of topics) {
    if (topic.substance >= 2) { // Only substantial discussions
      log(`  📰 Writing story: ${topic.description}`, 'story-generation')

      const storyPrompt = FOCUSED_STORY_PROMPT
        .replace('{topicDescription}', topic.description)
        .replace('{category}', topic.category || 'discussion')
        .replace('{messages}', messages)
        .replace('{channelName}', 'channel') // We'll need to pass this in later

      const storyResponse = await openai.chat.completions.create({
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
        content: storyResponse.choices[0].message.content
      })

      // Add to usage tracking
      totalUsage.prompt_tokens += storyResponse.usage.prompt_tokens
      totalUsage.completion_tokens += storyResponse.usage.completion_tokens
      totalUsage.total_tokens += storyResponse.usage.total_tokens
    }
  }

  // Pass 3: Generate catchall story for remaining content
  log('🔍 Pass 3: Generating community highlights for remaining content...', 'catchall-generation-start')
  
  const mainStoriesContent = stories.map(s => s.content).join('\n\n')
  const catchallPrompt = CATCHALL_STORY_PROMPT
    .replace('{mainStories}', mainStoriesContent)
    .replace('{messages}', messages)

  const catchallResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a tech journalist writing community highlights for "The Daily Discord Times".'
      },
      {
        role: 'user',
        content: catchallPrompt
      }
    ],
    max_tokens: Math.floor(maxTokens / 4) // Allocate 1/4 of tokens for catchall
  })

  const catchallContent = catchallResponse.choices[0].message.content
  log(`📝 Generated community highlights: ${catchallContent.substring(0, 100)}...`, 'catchall-generated')

  // Add catchall usage to tracking
  totalUsage.prompt_tokens += catchallResponse.usage.prompt_tokens
  totalUsage.completion_tokens += catchallResponse.usage.completion_tokens
  totalUsage.total_tokens += catchallResponse.usage.total_tokens

  // Pass 4: Simple concatenation (no AI assembly)
  log('📰 Pass 4: Concatenating final newspaper...', 'assembly-start')
  
  let finalSummary = `# Daily Report: #channel\n\n`
  finalSummary += mainStoriesContent
  
  if (catchallContent.trim() !== 'No additional highlights to report.') {
    finalSummary += '\n\n' + catchallContent
  }

  log(`✅ Multi-pass complete. Generated ${stories.length} main stories + catchall using ${totalUsage.total_tokens} tokens`, 'complete')

  // Post-process to remove duplicate URLs (now working on concatenated summary)
  const urlPattern = /(https?:\/\/[^\s\])]+)/g
  const urls = finalSummary.match(urlPattern) || []
  const urlCounts = {}
  
  // Count URL occurrences
  urls.forEach(url => {
    urlCounts[url] = (urlCounts[url] || 0) + 1
  })
  
  // Remove duplicate inline URLs (keep first occurrence)
  const seenUrls = new Set()
  finalSummary = finalSummary.replace(urlPattern, (match) => {
    if (seenUrls.has(match)) {
      return '' // Remove duplicate
    }
    seenUrls.add(match)
    return match
  })
  
  log(`🔧 Post-processing: removed ${urls.length - seenUrls.size} duplicate URLs`, 'deduplication')

  const result = {
    summary: finalSummary,
    usage: totalUsage,
    metadata: {
      approach: 'multi-pass-with-catchall',
      passes: 4,
      topicsFound: topics.length,
      storiesGenerated: stories.length,
      hasCatchall: true,
      duplicateUrlsRemoved: urls.length - seenUrls.size,
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

  const response = await openai.chat.completions.create({
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
    summary: response.choices[0].message.content,
    usage: response.usage,
    metadata: {
      approach: 'single-pass'
    }
  }
}

module.exports = {
  summarizeMessages
}
