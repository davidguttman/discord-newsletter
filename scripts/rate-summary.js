#!/usr/bin/env node

const axios = require('axios')
const { Command } = require('commander')
const { Configuration, OpenAIApi } = require('openai')
const dotenv = require('dotenv')
const { format, parseISO, eachDayOfInterval, startOfDay, endOfDay } = require('date-fns')
const fs = require('fs')
const path = require('path')

dotenv.config() // Load .env variables

// OpenAI Client Setup
let openai
if (process.env.OPENAI_API_KEY) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
  openai = new OpenAIApi(configuration)
} else {
  console.warn('OPENAI_API_KEY not found in .env. Rate mode will be unavailable.')
}

const program = new Command()

program
  .name('rate-summary')
  .description('Collects Discord message/summary data and rates summary quality.')
  .version('1.0.0')

program
  .command('collect')
  .description('Collect message and summary data for a given date range.')
  .requiredOption('-s, --start-date <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('-e, --end-date <date>', 'End date (YYYY-MM-DD)')
  .requiredOption('-c, --channel-id <id>', 'Discord Channel ID')
  .requiredOption('-o, --origin <url>', 'API Server Origin (e.g., http://localhost:3000)')
  .option('-d, --data-dir <dir>', 'Directory to store collected data', './summary_data')
  .action(collectData)

program
  .command('rate')
  .description('Rate the quality of collected summaries using AI.')
  .option('-d, --data-dir <dir>', 'Directory containing collected data', './summary_data')
  .option('-m, --model <name>', 'OpenAI model for rating', 'gpt-3.5-turbo')
  .action(rateSummaries)

// Functions

// --- Collect Mode ---

async function collectData (options) {
  const { startDate, endDate, channelId, origin, dataDir } = options
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dateRange = eachDayOfInterval({ start, end })

  console.log(`Collecting data for Channel ID: ${channelId}`)
  console.log(`Date Range: ${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`)
  console.log(`Saving data to: ${dataDir}`)

  for (const date of dateRange) {
    const formattedDate = format(date, 'yyyy-MM-dd')
    console.log(`Fetching data for ${formattedDate}...`)
    try {
      await fetchDataForDate({ date, channelId, origin, dataDir }) // Pass options object
      console.log(`Successfully fetched data for ${formattedDate}`)
    } catch (error) {
      console.error(`Failed to fetch data for ${formattedDate}:`, error.message)
      if (error.response) {
        console.error('API Response:', error.response.data)
      }
    }
    // Optional: Add a small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  console.log('Data collection complete.')
}

async function fetchDataForDate (options) {
  const { date, channelId, origin, dataDir } = options // Destructure options
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  const formattedDate = format(date, 'yyyy-MM-dd')

  const messagesUrl = `${origin}/messages`
  const summarizeUrl = `${origin}/summarize/channel/${channelId}`

  // 1. Fetch Messages (TXT format)
  const messagesResponse = await axios.get(messagesUrl, {
    params: {
      channelId,
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
      limit: 10000, // Adjust if necessary, fetch all for the day
      format: 'txt'
    },
    responseType: 'text' // Ensure we get plain text
  })
  const messagesTxt = messagesResponse.data

  // 2. Fetch Summary (JSON format)
  const summaryResponse = await axios.get(summarizeUrl, {
    params: {
      startDate: dayStart.toISOString(),
      endDate: dayEnd.toISOString(),
      format: 'json' // Request JSON to get summary and usage data
    }
  })
  const summaryJson = summaryResponse.data
  const summaryText = summaryJson.summary // Extract the markdown summary text

  // 3. Store Data
  const dateDir = path.join(dataDir, formattedDate)
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir)
  }

  fs.writeFileSync(path.join(dateDir, 'messages.txt'), messagesTxt)
  // Save only the summary text to summary.txt
  fs.writeFileSync(path.join(dateDir, 'summary.txt'), summaryText)
}

// --- Rate Mode ---

async function rateSummaries (options) {
  const { dataDir, model } = options

  if (!openai) {
    console.error('OpenAI API key not configured. Cannot run rate mode.')
    process.exit(1)
  }

  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`)
    process.exit(1)
  }

  const dateDirs = fs.readdirSync(dataDir).filter(entry =>
    fs.statSync(path.join(dataDir, entry)).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry)
  )

  console.log(`Rating summaries found in: ${dataDir}`)
  console.log(`Using OpenAI model: ${model}`)

  for (const dateDirName of dateDirs) {
    const dateDirPath = path.join(dataDir, dateDirName)
    const messagesPath = path.join(dateDirPath, 'messages.txt')
    const summaryPath = path.join(dateDirPath, 'summary.txt')
    const ratingPath = path.join(dateDirPath, 'rating.json')

    if (fs.existsSync(ratingPath)) {
      console.log(`Skipping ${dateDirName}, rating already exists.`)
      continue
    }

    if (!fs.existsSync(messagesPath) || !fs.existsSync(summaryPath)) {
      console.warn(`Skipping ${dateDirName}, missing messages.txt or summary.txt`)
      continue
    }

    console.log(`Rating summary for ${dateDirName}...`)
    try {
      const messages = fs.readFileSync(messagesPath, 'utf8')
      const summaryText = fs.readFileSync(summaryPath, 'utf8')

      // Pass options object to rateSingleSummary
      const ratingResult = await rateSingleSummary({ messages, summary: summaryText, model })

      fs.writeFileSync(ratingPath, JSON.stringify(ratingResult, null, 2))
      console.log(`Successfully rated summary for ${dateDirName}`)
    } catch (error) {
      console.error(`Failed to rate summary for ${dateDirName}:`, error.message)
      if (error.response && error.response.data) {
        console.error('OpenAI API Error:', error.response.data)
      }
    }
    // Optional: Add a small delay
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  console.log('Summary rating complete.')
}

async function rateSingleSummary (options) {
  const { messages, summary, model } = options // Destructure options
  if (!openai) throw new Error('OpenAI client not initialized.')

  const prompt = `
Rate the quality of the provided summary based on the original messages.

**Original Messages:**
\`\`\`
${messages}
\`\`\`

**Generated Summary:**
\`\`\`
${summary}
\`\`\`

**Rating Criteria:**

1.  **Completeness:** Did the summary capture the most important topics, decisions, and action items mentioned in the messages? (Score 1-5)
2.  **Accuracy:** Does the summary accurately reflect the content and tone of the messages? Are there any misrepresentations? (Score 1-5)
3.  **Conciseness & Fluff:** Is the summary concise? Does it contain unnecessary preamble, commentary, or filler ("fluff")? (Score 1-5, higher is better/less fluff)
4.  **Resource & Link Inclusion:** Were all mentioned resources, links, tips, or techniques correctly included and linked appropriately in the summary? (Score 1-5)
5.  **Missed Items:** Were there any significant conversations, questions, or important points completely missed by the summary? (Score 1-5, higher means fewer missed items)

**Provide your rating as a JSON object with keys "completeness", "accuracy", "conciseness", "resource_inclusion", "missed_items", and a "differences" that goes into detail about specifics and what was missed or misrepresented.**

Example JSON Output:
{
  "completeness": 4,
  "accuracy": 5,
  "conciseness": 3,
  "resource_inclusion": 5,
  "missed_items": 4,
  "overall_comment": "Good summary, but slightly verbose in some areas. Captured all key links."
}
`

  try {
    const response = await openai.createChatCompletion({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant designed to evaluate the quality of text summaries based on provided criteria. Output ONLY the JSON rating object.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Lower temperature for more deterministic rating
      max_tokens: 2500 // Adjust as needed
    })

    const ratingJsonString = response.data.choices[0].message.content
    // Attempt to parse the JSON, handling potential issues
    try {
      // Clean the string: remove potential markdown fences and trim whitespace
      const cleanedJsonString = ratingJsonString.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const rating = JSON.parse(cleanedJsonString)
      return {
        rating,
        usage: response.data.usage
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI rating response as JSON:', ratingJsonString) // Log original string for context
      // Return the raw response string if parsing fails, for debugging
      return {
        rating: { error: 'Failed to parse rating JSON', raw_response: ratingJsonString },
        usage: response.data.usage
      }
    }
  } catch (error) {
    console.error('Error calling OpenAI API for rating:', error)
    throw error // Re-throw the error to be caught in rateSummaries
  }
}

// --- Main Execution ---

// Add this check before program.parse()
if (process.argv.length <= 2) {
  program.help() // Show help if no command is specified
}

program.parse(process.argv)

// Add an empty default handler or check if a command was executed
if (!program.args.length) {
  // Optional: Add a message if needed, or rely on commander's default behavior
}
