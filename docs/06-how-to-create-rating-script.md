# How to Create a Summary Rating Script

This tutorial walks you through creating a script to collect Discord message data and AI-generated summaries from the application's API, and then use another AI model to rate the quality of those summaries.

This script will have two primary modes: `collect` and `rate`.

## Prerequisites

Before you start, make sure you have Node.js installed and the project dependencies set up (`npm install`).

You'll also need to install a few extra dependencies for this script:

```bash
npm install axios commander openai dotenv date-fns
```

- `axios`: For making HTTP requests to the API.
- `commander`: For creating a command-line interface for the script.
- `openai`: To interact with the OpenAI API for rating.
- `dotenv`: To load environment variables (like your OpenAI API key).
- `date-fns`: For easy date manipulation.

Finally, ensure you have an OpenAI API key set in your `.env` file:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Step 1: Script Setup

1.  **Create the script file**: Create a new file named `rate-summary.js` in the project's root directory (or a `scripts/` directory if you prefer).
2.  **Add Shebang**: Start the file with `#!/usr/bin/env node` to make it executable.
3.  **Import Dependencies**: Import the necessary libraries.

```javascript
#!/usr/bin/env node

const axios = require('axios')
const { Command } = require('commander')
const { Configuration, OpenAIApi } = require('openai')
const dotenv = require('dotenv')
const { format, parseISO, eachDayOfInterval, startOfDay, endOfDay } = require('date-fns')
const fs = require('fs')
const path = require('path')

dotenv.config() // Load .env variables

// TODO: Add OpenAI client setup
// TODO: Add Commander program setup
// TODO: Add Collect Mode logic
// TODO: Add Rate Mode logic
// TODO: Add Main execution logic
```

## Step 2: Configure OpenAI Client

Set up the OpenAI client using the API key from your environment variables. This will be used in the `rate` mode.

```javascript
// ... imports ...

dotenv.config()

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

// ... rest of the script ...
```

## Step 3: Set Up Command-Line Interface (CLI)

Use `commander` to define the script's commands, options, and arguments.

```javascript
// ... imports and OpenAI setup ...

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
  .action(collectData) // We'll define this function next

program
  .command('rate')
  .description('Rate the quality of collected summaries using AI.')
  .option('-d, --data-dir <dir>', 'Directory containing collected data', './summary_data')
  .option('-m, --model <name>', 'OpenAI model for rating', 'gpt-3.5-turbo') // Or choose another suitable model
  .action(rateSummaries) // We'll define this function later

// ... rest of the script ...

// Parse arguments at the end
program.parse(process.argv)
```

## Step 4: Implement Collect Mode

This mode fetches data day-by-day for the specified range.

1.  **`collectData` Function**: This function orchestrates the collection process.
2.  **`fetchDataForDate` Function**: This helper fetches messages (TXT) and summary (JSON) for a single day.
3.  **Data Storage**: Save the fetched data into the specified directory, organized by date.

```javascript
// ... imports, OpenAI setup, commander setup ...

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
      await fetchDataForDate(date, channelId, origin, dataDir)
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

async function fetchDataForDate (date, channelId, origin, dataDir) {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  const formattedDate = format(date, 'yyyy-MM-dd')

  const messagesUrl = `${origin}/api/messages`
  const summarizeUrl = `${origin}/api/summarize/channel/${channelId}`

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

  // 3. Store Data
  const dateDir = path.join(dataDir, formattedDate)
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir)
  }

  fs.writeFileSync(path.join(dateDir, 'messages.txt'), messagesTxt)
  fs.writeFileSync(path.join(dateDir, 'summary.json'), JSON.stringify(summaryJson, null, 2))
}

// ... Rate Mode and main execution ...
```

## Step 5: Implement Rate Mode

This mode reads the collected data and sends it to OpenAI for rating.

1.  **`rateSummaries` Function**: Orchestrates the rating process.
2.  **`rateSingleSummary` Function**: Sends a specific day's messages and summary to the OpenAI API with a rating prompt.
3.  **Rating Prompt**: Design a prompt that asks the AI to evaluate the summary based on specific criteria (completeness, accuracy, conciseness, link inclusion, fluff, missed items).
4.  **Store Ratings**: Save the AI's rating alongside the original data.

```javascript
// ... imports, setup, collect mode ...

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
    const summaryPath = path.join(dateDirPath, 'summary.json')
    const ratingPath = path.join(dateDirPath, 'rating.json')

    if (fs.existsSync(ratingPath)) {
        console.log(`Skipping ${dateDirName}, rating already exists.`)
        continue
    }

    if (!fs.existsSync(messagesPath) || !fs.existsSync(summaryPath)) {
      console.warn(`Skipping ${dateDirName}, missing messages.txt or summary.json`)
      continue
    }

    console.log(`Rating summary for ${dateDirName}...`)
    try {
      const messages = fs.readFileSync(messagesPath, 'utf8')
      const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
      const summaryText = summaryData.summary // Extract the actual summary string

      const ratingResult = await rateSingleSummary(messages, summaryText, model)

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

async function rateSingleSummary (messages, summary, model) {
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

**Provide your rating as a JSON object with keys "completeness", "accuracy", "conciseness", "resource_inclusion", "missed_items", and a brief "overall_comment".**

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
      model: model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant designed to evaluate the quality of text summaries based on provided criteria. Output ONLY the JSON rating object.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Lower temperature for more deterministic rating
      max_tokens: 250 // Adjust as needed
    })

    const ratingJsonString = response.data.choices[0].message.content
    // Attempt to parse the JSON, handling potential issues
    try {
        const rating = JSON.parse(ratingJsonString.trim())
        return {
            rating,
            usage: response.data.usage
        }
    } catch (parseError) {
        console.error("Failed to parse OpenAI rating response as JSON:", ratingJsonString)
        // Return the raw response string if parsing fails, for debugging
        return {
            rating: { error: "Failed to parse rating JSON", raw_response: ratingJsonString },
            usage: response.data.usage
        }
    }

  } catch (error) {
    console.error('Error calling OpenAI API for rating:', error)
    throw error // Re-throw the error to be caught in rateSummaries
  }
}

// ... main execution ...
```

*Self-Correction*: The initial `rateSingleSummary` prompt didn't explicitly ask for JSON output only, which can lead to extraneous text from the AI. Updated the system message to enforce JSON-only output and added parsing with error handling. Also added error logging for OpenAI API calls. Included `usage` data in the stored rating. Added check to skip rating if `rating.json` already exists.

## Step 6: Main Execution Block

Add a simple check to ensure a command is provided when running the script.

```javascript
// ... imports, setup, collect mode, rate mode ...

// --- Main Execution ---

// Add this check before program.parse()
if (process.argv.length <= 2) {
  program.help(); // Show help if no command is specified
}

program.parse(process.argv)

// Add an empty default handler or check if a command was executed
if (!program.args.length) {
 // Optional: Add a message if needed, or rely on commander's default behavior
}
```

*Self-Correction*: Without checking `process.argv.length`, running the script with no arguments would do nothing silently. Added a check to display help. Also, `commander` handles the case where no known command is given, but added a placeholder check for `program.args.length` if more explicit handling is desired later.

## Step 7: Make Executable and Run

1.  **Make executable**: `chmod +x rate-summary.js`
2.  **Run Collect Mode**:
    ```bash
    ./rate-summary.js collect --start-date 2023-10-26 --end-date 2023-10-27 --channel-id YOUR_CHANNEL_ID --origin http://localhost:3000 --data-dir ./collected_summaries
    ```
    (Replace `YOUR_CHANNEL_ID` and adjust dates/origin/directory as needed).
3.  **Run Rate Mode**:
    ```bash
    ./rate-summary.js rate --data-dir ./collected_summaries
    ```
    (Ensure your `OPENAI_API_KEY` is set in `.env`).

This script provides a foundation for systematically evaluating the quality of the AI-generated summaries against the original message content. You can further expand it by adding more sophisticated analysis, different rating models, or integrating it into an automated workflow.
