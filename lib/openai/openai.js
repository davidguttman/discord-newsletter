const { Configuration, OpenAIApi } = require('openai')
const config = require('../../config')

// Initialize OpenAI client on startup
if (!config.openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

const configuration = new Configuration({
  apiKey: config.openaiApiKey
})

const openai = new OpenAIApi(configuration)

// Generate summary for given messages
async function summarizeMessages (messages, options = {}) {
  const model = options.model || config.openaiModel
  const maxTokens = options.maxTokens || config.openaiMaxTokens

  try {
    const response = await openai.createChatCompletion({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an in-depth tech journalist. You write detailed reports, and you do not gloss over specifics.'
        },
        {
          role: 'user',
          content: `I need a daily email in markdown format that will allow me to stay up to date on what's going on in discord channels. write a detailed news report. Never say "a user" always use their username. No fluff preamble, conclusion, or commentary.

NEVER: soandso expressed excitement about whatever
INSTEAD: soandso is excited about whatever

NEVER: soandso commented on whatever, indicating wanting to get it later
INSTEAD: soandso wants to get whatever

if you mention a tip, technique, or resource, link it. (always link the noun like "github repo" and never "you can find the repo here\n\n${messages}`
        }
      ],
      max_tokens: maxTokens
    })

    return {
      summary: response.data.choices[0].message.content,
      usage: response.data.usage
    }
  } catch (error) {
    console.error('Error generating summary:', error)
    throw error
  }
}

module.exports = {
  summarizeMessages
}
