// TypeScript-like type definitions for BrainyFlow Memory stores
// These interfaces document the expected structure for Discord Newsletter flows

/**
 * Global Memory Store for Discord Newsletter flows
 * Shared across all nodes in a flow execution
 */
const GlobalStoreInterface = {
  // Input data
  guildId: 'string',
  channelId: 'string',
  messages: 'Message[]', // Array of Discord messages
  formattedMessages: 'string', // Text-formatted conversation

  // Processing parameters
  since: 'string', // Time period like '24h', '1d'
  startDate: 'Date',
  endDate: 'Date',
  options: 'object', // { model, maxTokens, debug, etc. }

  // Topic extraction results
  topics: 'Topic[]', // Array of extracted topics
  rawTopicsResponse: 'string', // Raw LLM response

  // Story generation results
  stories: 'Story[]', // Array of generated stories
  catchallStory: 'string', // Community highlights

  // Final output
  summary: 'string', // Final newsletter content
  usage: 'object', // OpenAI token usage stats
  metadata: 'object', // Generation metadata

  // Email formatting
  emailContent: 'string', // HTML or text email content
  emailSubject: 'string'
}

/**
 * Local Memory Store for individual nodes
 * Can be forked for parallel processing
 */
const LocalStoreInterface = {
  // Node-specific temporary data
  nodeInput: 'any',
  nodeOutput: 'any',
  nodeError: 'Error',

  // Parallel processing data
  currentTopic: 'Topic',
  currentStory: 'Story',
  batchIndex: 'number'
}

/**
 * Topic structure from topic extraction
 */
const TopicInterface = {
  id: 'string',
  description: 'string',
  substance: 'number', // 1-5 rating
  category: 'string'
}

/**
 * Story structure from story generation
 */
const StoryInterface = {
  topic: 'Topic',
  content: 'string'
}

module.exports = {
  GlobalStoreInterface,
  LocalStoreInterface,
  TopicInterface,
  StoryInterface
}
