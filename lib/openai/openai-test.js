// Mock summaries for testing
const MOCK_SUMMARIES = {
  default: 'This is a mock summary of the conversation.',
  short: 'Brief mock summary.',
  long: 'This is an extended mock summary with multiple points discussed in the conversation. The participants talked about various topics including project updates, technical issues, and future plans.'
}

// Mock OpenAI client for testing
async function summarizeMessages (messages, options = {}) {
  // Determine which mock to return based on message length
  let summaryType = 'default'

  if (messages.length < 100) {
    summaryType = 'short'
  } else if (messages.length > 1000) {
    summaryType = 'long'
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50))

  return {
    summary: MOCK_SUMMARIES[summaryType],
    usage: {
      prompt_tokens: messages.length,
      completion_tokens: MOCK_SUMMARIES[summaryType].length,
      total_tokens: messages.length + MOCK_SUMMARIES[summaryType].length
    }
  }
}

module.exports = {
  summarizeMessages
}
