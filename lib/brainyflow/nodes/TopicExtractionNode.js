// TopicExtractionNode - Extracts topics from Discord messages using LLM

const { Node } = require('brainyflow')
// Create a simple topic extraction prompt
const TOPIC_EXTRACTION_PROMPT = `Analyze the following Discord messages and extract the main topics being discussed.

For each topic, provide:
- id: a short kebab-case identifier
- description: a brief description of the topic
- substance: integer from 1-5 indicating how substantial the discussion is
- category: general category like "technology", "general", "development", etc.

Messages:
{messages}

Return JSON in this format:
{
  "topics": [
    {
      "id": "example-topic",
      "description": "Brief description of what this topic covers",
      "substance": 3,
      "category": "general"
    }
  ]
}`
const openai = require('../../openai')
const config = require('../../../config')
const { debugLog, accumulateUsage } = require('../utils')

class TopicExtractionNode extends Node {
  async prep (memory) {
    const { formattedMessages, options } = memory

    if (!formattedMessages) {
      throw new Error('TopicExtractionNode: formattedMessages is required')
    }

    debugLog(
      '📝 TopicExtractionNode: Extracting topics from messages...',
      'topic-extraction-start',
      options.debug ? memory.debugSteps : null
    )

    const model = options.model || config.openaiModel

    return { formattedMessages, model, options }
  }

  async exec ({ formattedMessages, model, options }) {
    const client = openai.getClient()

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing Discord conversations and identifying distinct topics.'
        },
        {
          role: 'user',
          content: TOPIC_EXTRACTION_PROMPT.replace('{messages}', formattedMessages)
        }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    return {
      response: response.choices[0].message.content,
      usage: response.usage
    }
  }

  async post (memory, prepResult, execResult) {
    const { response, usage } = execResult
    const { options } = memory

    // Accumulate usage statistics
    accumulateUsage(memory.usage, usage)

    debugLog(
      `📥 TopicExtractionNode: Raw response: ${response.substring(0, 200)}...`,
      'raw-response',
      options.debug ? memory.debugSteps : null
    )

    // Parse topics from response
    let topics
    try {
      const parsedResponse = JSON.parse(response)
      topics = parsedResponse.topics || []
    } catch (parseError) {
      debugLog(
        `⚠️ TopicExtractionNode: JSON parsing failed: ${parseError.message}. Retrying with JSON fix...`,
        'json-parse-error',
        options.debug ? memory.debugSteps : null
      )

      // Retry with JSON fix
      topics = await this.fixJsonResponse(response, memory)
    }

    // Filter for substantial topics
    const substantialTopics = topics.filter(t => t.substance >= 1)

    if (substantialTopics.length === 0) {
      debugLog(
        '📝 TopicExtractionNode: No substantial topics found, creating general topic',
        'no-substantial-topics',
        options.debug ? memory.debugSteps : null
      )

      topics = [{
        id: 'general-discussion',
        description: 'General channel discussion and activity',
        substance: 3,
        category: 'general'
      }]
    } else {
      topics = substantialTopics
    }

    // Store in memory
    memory.topics = topics
    memory.rawTopicsResponse = response

    debugLog(
      `📊 TopicExtractionNode: Found ${topics.length} topics: ${topics.map(t => t.description).join(', ')}`,
      'topics-extracted',
      options.debug ? memory.debugSteps : null
    )

    // Update metadata
    memory.metadata.topicsFound = topics.length
    memory.metadata.topics = topics.map(t => ({
      description: t.description,
      substance: t.substance
    }))
  }

  async fixJsonResponse (invalidJson, memory) {
    const { options } = memory
    const client = openai.getClient()
    const model = options.model || config.openaiModel

    const fixResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Fix the following text to be valid JSON format only. Return only the corrected JSON, no other text.'
        },
        {
          role: 'user',
          content: `Fix this to valid JSON:\n${invalidJson}`
        }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    // Accumulate usage from fix attempt
    accumulateUsage(memory.usage, fixResponse.usage)

    try {
      const fixedResponse = fixResponse.choices[0].message.content
      debugLog(
        `📥 TopicExtractionNode: Fixed JSON response: ${fixedResponse ? fixedResponse.substring(0, 200) : 'null'}...`,
        'json-fixed',
        options.debug ? memory.debugSteps : null
      )

      const parsedResponse = JSON.parse(fixedResponse)
      return parsedResponse.topics || []
    } catch (secondError) {
      debugLog(
        `⚠️ TopicExtractionNode: JSON fix also failed: ${secondError.message}. Creating single general topic.`,
        'json-fix-failed',
        options.debug ? memory.debugSteps : null
      )

      // Return a single general topic if both attempts fail
      return [{
        id: 'general-discussion',
        description: 'General channel discussion and activity',
        substance: 3,
        category: 'general'
      }]
    }
  }
}

module.exports = TopicExtractionNode
