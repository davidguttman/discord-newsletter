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
