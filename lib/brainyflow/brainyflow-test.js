// Test/Mock BrainyFlow implementation for Discord Newsletter

const openaiTest = require('../openai/openai-test')
const config = require('../../config')
const { shouldUseBrainyFlow, logRolloutDecision } = require('./monitoring')

/**
 * Mock BrainyFlow implementation that delegates to existing test infrastructure
 * This ensures tests continue to work during migration
 */

async function summarizeMessages (formattedMessages, options = {}) {
  const context = { options, messagesLength: formattedMessages.length }

  // Check if BrainyFlow should be used (includes feature flag and rollout logic)
  if (!shouldUseBrainyFlow(context)) {
    logRolloutDecision(false, context)
    // Fall back to original OpenAI implementation
    return await openaiTest.summarizeMessages(formattedMessages, options)
  }

  logRolloutDecision(true, context)

  // Determine flow type and call appropriate mock flow
  if (options.flow === 'simple') {
    return await runSimpleFlow(formattedMessages, options)
  } else {
    return await runNewsletterFlow(formattedMessages, options)
  }
}

async function runSimpleFlow (formattedMessages, options = {}) {
  const result = await openaiTest.summarizeMessages(formattedMessages, options)
  return {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      approach: 'brainyflow-simple',
      flow: 'simple'
    }
  }
}

async function runNewsletterFlow (formattedMessages, options = {}) {
  const result = await openaiTest.summarizeMessages(formattedMessages, options)
  return {
    ...result,
    metadata: {
      ...(result.metadata || {}),
      approach: 'brainyflow-newsletter',
      flow: 'newsletter'
    }
  }
}

async function runEmailFlow (guildId, channelId, since, emailOptions = {}, processingOptions = {}) {
  // Mock email flow for testing
  return {
    success: true,
    guildId,
    channelId,
    since,
    startDate: new Date(),
    endDate: new Date(),
    messageCount: 5,
    emailId: 'test-email-id',
    summary: 'Test newsletter summary',
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    metadata: { approach: 'test-brainyflow-email', flow: 'email' }
  }
}

function getClient () {
  return openaiTest.getClient()
}

module.exports = {
  summarizeMessages,
  runSimpleFlow,
  runNewsletterFlow,
  runEmailFlow,
  getClient
}
