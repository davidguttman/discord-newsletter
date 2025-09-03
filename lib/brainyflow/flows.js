// BrainyFlow Flow compositions for Discord Newsletter

const config = require('../../config')
const { createDiscordMemory } = require('./utils')

// Import all nodes
const MessageFetchNode = require('./nodes/MessageFetchNode')
const TopicExtractionNode = require('./nodes/TopicExtractionNode')
const SummaryGenerationNode = require('./nodes/SummaryGenerationNode')
const NewsletterFormatterNode = require('./nodes/NewsletterFormatterNode')
const EmailFormatterNode = require('./nodes/EmailFormatterNode')
const TextFormatterNode = require('./nodes/TextFormatterNode')
const EmailDeliveryNode = require('./nodes/EmailDeliveryNode')

/**
 * Simple flow implementation using sequential node execution
 */
async function createSimpleFlow () {
  return {
    async run (memory) {
      const summaryNode = new SummaryGenerationNode()
      const textFormatterNode = new TextFormatterNode()

      // Execute nodes sequentially
      const prepResult1 = await summaryNode.prep(memory)
      const execResult1 = await summaryNode.exec(prepResult1)
      await summaryNode.post(memory, prepResult1, execResult1)

      const prepResult2 = await textFormatterNode.prep(memory)
      const execResult2 = await textFormatterNode.exec(prepResult2)
      await textFormatterNode.post(memory, prepResult2, execResult2)
    }
  }
}

/**
 * Newsletter flow implementation using sequential node execution
 */
async function createNewsletterFlow () {
  return {
    async run (memory) {
      const topicNode = new TopicExtractionNode()
      const summaryNode = new SummaryGenerationNode()
      const formatterNode = new NewsletterFormatterNode()

      // Execute nodes sequentially
      const prepResult1 = await topicNode.prep(memory)
      const execResult1 = await topicNode.exec(prepResult1)
      await topicNode.post(memory, prepResult1, execResult1)

      const prepResult2 = await summaryNode.prep(memory)
      const execResult2 = await summaryNode.exec(prepResult2)
      await summaryNode.post(memory, prepResult2, execResult2)

      const prepResult3 = await formatterNode.prep(memory)
      const execResult3 = await formatterNode.exec(prepResult3)
      await formatterNode.post(memory, prepResult3, execResult3)
    }
  }
}

/**
 * Email flow implementation using sequential node execution
 */
async function createEmailFlow () {
  return {
    async run (memory) {
      const fetchNode = new MessageFetchNode()
      const topicNode = new TopicExtractionNode()
      const summaryNode = new SummaryGenerationNode()
      const emailFormatterNode = new EmailFormatterNode()
      const emailDeliveryNode = new EmailDeliveryNode()

      // Execute nodes sequentially
      const prepResult1 = await fetchNode.prep(memory)
      const execResult1 = await fetchNode.exec(prepResult1)
      await fetchNode.post(memory, prepResult1, execResult1)

      const prepResult2 = await topicNode.prep(memory)
      const execResult2 = await topicNode.exec(prepResult2)
      await topicNode.post(memory, prepResult2, execResult2)

      const prepResult3 = await summaryNode.prep(memory)
      const execResult3 = await summaryNode.exec(prepResult3)
      await summaryNode.post(memory, prepResult3, execResult3)

      const prepResult4 = await emailFormatterNode.prep(memory)
      const execResult4 = await emailFormatterNode.exec(prepResult4)
      await emailFormatterNode.post(memory, prepResult4, execResult4)

      const prepResult5 = await emailDeliveryNode.prep(memory)
      const execResult5 = await emailDeliveryNode.exec(prepResult5)
      await emailDeliveryNode.post(memory, prepResult5, execResult5)
    }
  }
}

/**
 * Execute Simple Flow
 * @param {string} formattedMessages - Pre-formatted message text
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Summary result
 */
async function runSimpleFlow (formattedMessages, options = {}) {
  const memory = createDiscordMemory({ options })
  memory.formattedMessages = formattedMessages

  // Create a basic summary directly for simple flow
  // Since we don't have topics, we'll need to generate a simple summary
  memory.topics = [{
    id: 'general-discussion',
    description: 'General channel discussion and activity',
    substance: 3,
    category: 'general'
  }]

  const flow = await createSimpleFlow()
  await flow.run(memory)

  return {
    summary: memory.summary,
    usage: memory.usage,
    metadata: {
      ...memory.metadata,
      approach: 'brainyflow-simple',
      flow: 'simple'
    }
  }
}

/**
 * Execute Newsletter Flow
 * @param {string} formattedMessages - Pre-formatted message text
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Summary result
 */
async function runNewsletterFlow (formattedMessages, options = {}) {
  const memory = createDiscordMemory({ options })
  memory.formattedMessages = formattedMessages

  const flow = await createNewsletterFlow()
  await flow.run(memory)

  return {
    summary: memory.summary,
    usage: memory.usage,
    metadata: {
      ...memory.metadata,
      approach: 'brainyflow-newsletter',
      flow: 'newsletter'
    }
  }
}

/**
 * Execute Email Flow
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {string} since - Time period like '24h', '1d'
 * @param {Object} emailOptions - Email settings { to, subject, format }
 * @param {Object} processingOptions - AI processing options
 * @returns {Promise<Object>} Email delivery result
 */
async function runEmailFlow (guildId, channelId, since, emailOptions = {}, processingOptions = {}) {
  const memory = createDiscordMemory({
    guildId,
    channelId,
    since,
    options: processingOptions
  })

  // Set email options in memory
  memory.emailOptions = emailOptions

  const flow = await createEmailFlow()
  await flow.run(memory)

  return {
    success: true,
    guildId,
    channelId,
    since,
    startDate: memory.startDate,
    endDate: memory.endDate,
    messageCount: memory.messages.length,
    emailId: memory.emailId,
    summary: memory.summary,
    usage: memory.usage,
    metadata: {
      ...memory.metadata,
      approach: 'brainyflow-email',
      flow: 'email'
    }
  }
}

module.exports = {
  createSimpleFlow,
  createNewsletterFlow,
  createEmailFlow,
  runSimpleFlow,
  runNewsletterFlow,
  runEmailFlow
}
