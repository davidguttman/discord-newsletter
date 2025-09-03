// SummaryGenerationNode - Generates summaries for topics using multi-pass approach

const { Node } = require('brainyflow')
const { STORY_WRITING_PROMPT, CATCHALL_STORY_PROMPT } = require('../../openai/newspaper-prompts')
const openai = require('../../openai')
const config = require('../../../config')
const { debugLog, accumulateUsage } = require('../utils')

class SummaryGenerationNode extends Node {
  async prep (memory) {
    const { topics, formattedMessages, options } = memory

    if (!topics || topics.length === 0) {
      throw new Error('SummaryGenerationNode: topics are required')
    }

    if (!formattedMessages) {
      throw new Error('SummaryGenerationNode: formattedMessages is required')
    }

    debugLog(
      '✍️ SummaryGenerationNode: Generating individual stories...',
      'story-generation-start',
      options.debug ? memory.debugSteps : null
    )

    const model = options.model || config.openaiModel
    const maxTokens = options.maxTokens || config.openaiMaxTokens

    return { topics, formattedMessages, model, maxTokens, options }
  }

  async exec ({ topics, formattedMessages, model, maxTokens, options }) {
    const client = openai.getClient()
    const stories = []

    // Generate story for each substantial topic
    for (const topic of topics) {
      if (topic.substance >= 2) {
        debugLog(
          `  📰 SummaryGenerationNode: Writing story: ${topic.description}`,
          'story-generation'
        )

        const storyPrompt = STORY_WRITING_PROMPT
          .replace('{topicName}', topic.description)
          .replace('{topicMessages}', formattedMessages)

        const storyResponse = await client.chat.completions.create({
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

        // Collect usage for each story
        if (!this.totalUsage) {
          this.totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        }
        accumulateUsage(this.totalUsage, storyResponse.usage)
      }
    }

    return { stories, totalUsage: this.totalUsage }
  }

  async post (memory, prepResult, execResult) {
    const { stories, totalUsage } = execResult
    const { formattedMessages, options } = prepResult

    // Store stories in memory
    memory.stories = stories

    // Accumulate usage
    accumulateUsage(memory.usage, totalUsage)

    debugLog(
      `📝 SummaryGenerationNode: Generated ${stories.length} main stories`,
      'stories-generated',
      options.debug ? memory.debugSteps : null
    )

    // Generate catchall story for remaining content
    await this.generateCatchallStory(memory, formattedMessages, stories)

    // Create a simple summary from the stories for downstream nodes that expect it
    const summaryParts = []
    if (stories.length > 0) {
      summaryParts.push(...stories.map(story => story.content))
    }
    if (memory.catchallStory) {
      summaryParts.push(memory.catchallStory)
    }

    memory.summary = summaryParts.join('\n\n')

    // Update metadata
    memory.metadata.storiesGenerated = stories.length
    memory.metadata.hasCatchall = true
  }

  async generateCatchallStory (memory, formattedMessages, stories) {
    const { options } = memory

    debugLog(
      '🔍 SummaryGenerationNode: Generating community highlights for remaining content...',
      'catchall-generation-start',
      options.debug ? memory.debugSteps : null
    )

    const client = openai.getClient()
    const model = options.model || config.openaiModel
    const maxTokens = options.maxTokens || config.openaiMaxTokens

    const mainStoriesContent = stories.map(s => s.content).join('\n\n')
    const catchallPrompt = CATCHALL_STORY_PROMPT
      .replace('{mainStories}', mainStoriesContent)
      .replace('{messages}', formattedMessages)

    const catchallResponse = await client.chat.completions.create({
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
      max_tokens: Math.floor(maxTokens / 4)
    })

    const catchallContent = catchallResponse.choices[0].message.content
    memory.catchallStory = catchallContent

    // Accumulate catchall usage
    accumulateUsage(memory.usage, catchallResponse.usage)

    debugLog(
      `📝 SummaryGenerationNode: Generated community highlights: ${catchallContent.substring(0, 100)}...`,
      'catchall-generated',
      options.debug ? memory.debugSteps : null
    )
  }
}

module.exports = SummaryGenerationNode
