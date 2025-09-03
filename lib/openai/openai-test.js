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

// Mock getClient function
function getClient () {
  return {
    chat: {
      completions: {
        create: async (params) => {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 50))

          // Mock response based on the message content
          let mockContent = 'Mock response from OpenAI'

          // Specific mocks for different types of requests
          if (params.messages.some(m => m.content && m.content.includes('extract topics'))) {
            mockContent = JSON.stringify({
              topics: [
                {
                  id: 'general-discussion',
                  description: 'General channel discussion and activity',
                  substance: 3,
                  category: 'general'
                }
              ]
            })
          } else if (params.messages.some(m => m.content && m.content.includes('write stories'))) {
            mockContent = 'Mock story content for testing'
          } else if (params.messages.some(m => m.content && m.content.includes('Fix this to valid JSON'))) {
            // Mock JSON fix responses
            mockContent = JSON.stringify({
              topics: [
                {
                  id: 'general-discussion',
                  description: 'General channel discussion and activity',
                  substance: 3,
                  category: 'general'
                }
              ]
            })
          }

          return {
            choices: [{
              message: {
                content: mockContent
              }
            }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150
            }
          }
        }
      }
    }
  }
}

module.exports = {
  summarizeMessages,
  getClient
}
