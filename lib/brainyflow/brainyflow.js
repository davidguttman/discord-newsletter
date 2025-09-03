// Production BrainyFlow implementation for Discord Newsletter

const openai = require('../openai')
const { runSimpleFlow, runNewsletterFlow, runEmailFlow } = require('./flows')
const {
  recordFlowStart,
  recordFlowCompletion,
  shouldUseBrainyFlow,
  logRolloutDecision
} = require('./monitoring')

/**
 * Main summarization function that uses BrainyFlow
 * Maintains the same interface as the original OpenAI module
 * @param {string} formattedMessages - Pre-formatted message text
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Summary result
 */
async function summarizeMessages (formattedMessages, options = {}) {
  const context = { options, messagesLength: formattedMessages.length }

  // Check if BrainyFlow should be used (includes feature flag and rollout logic)
  if (!shouldUseBrainyFlow(context)) {
    logRolloutDecision(false, context)
    // Fall back to original OpenAI implementation
    return await openai.summarizeMessages(formattedMessages, options)
  }

  logRolloutDecision(true, context)

  // Determine flow type
  const flowType = options.flow === 'simple' ? 'simple' : 'newsletter'
  const executionContext = recordFlowStart(flowType, options)

  try {
    let result
    if (options.flow === 'simple') {
      result = await runSimpleFlow(formattedMessages, options)
    } else {
      result = await runNewsletterFlow(formattedMessages, options)
    }

    recordFlowCompletion(executionContext, true)
    return result
  } catch (error) {
    recordFlowCompletion(executionContext, false, error)
    throw error
  }
}

// Flow functions are now imported from ./flows.js

/**
 * Get the OpenAI client (for compatibility)
 */
function getClient () {
  return openai.getClient()
}

module.exports = {
  summarizeMessages,
  runSimpleFlow,
  runNewsletterFlow,
  runEmailFlow,
  getClient
}
