#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')
const config = require('./config')

// Direct HTTP request to OpenAI API for O3 support
async function callOpenAI (messages, model = 'o3') {
  const payload = {
    model,
    messages,
    response_format: { type: 'text' },
    reasoning_effort: 'low'
  }

  const data = JSON.stringify(payload)

  console.log('🔧 API Request payload size:', data.length, 'bytes')

  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Length': Buffer.byteLength(data, 'utf8')
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        console.log('🔧 API Response status:', res.statusCode)
        if (res.statusCode !== 200) {
          console.log('🔧 API Response body:', responseData.substring(0, 500))
        }

        try {
          const parsed = JSON.parse(responseData)
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.error?.message || responseData}`))
          } else {
            resolve(parsed)
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

const EVALUATION_PROMPT = `You are a fact-checking AI that analyzes newspaper summaries for accuracy against source messages.

Your task:
1. Compare the INPUT MESSAGES with the NEWSPAPER OUTPUT
2. Identify specific factual errors, hallucinations, and misattributions
3. Return ONLY a JSON array of issues found

Each issue should have:
- "type": one of ["missing_link", "hallucinated_link", "wrong_attribution", "fake_content", "misrepresentation", "context_error"]
- "description": brief description of the issue
- "severity": "low", "medium", or "high"
- "input_evidence": exact quote from input messages (if applicable)
- "output_evidence": exact quote from newspaper output showing the problem

Rules:
- ONLY report actual factual errors, not stylistic choices
- Focus on links, attributions, and content accuracy
- If a link exists in input but is missing/wrong in output, report it
- If content is invented that wasn't in the input, report it
- If attribution is wrong (wrong user said something), report it

Return ONLY the JSON array, no other text.

INPUT MESSAGES:
{input_messages}

NEWSPAPER OUTPUT:
{newspaper_output}

Analyze and return JSON array of issues:`

class NewspaperEvaluator {
  constructor () {
    this.inputMessages = null
    this.newspaperOutput = null
  }

  // Load input messages from sample file
  loadInputMessages () {
    const filePath = path.join(__dirname, 'channel-messages-sample.txt')
    const content = fs.readFileSync(filePath, 'utf8')

    // Extract just the message lines
    const messageLines = content.split('\n')
      .filter(line => line.match(/^\[.+?\] [^:]+: .+$/))
      .join('\n')

    this.inputMessages = messageLines
    console.log(`📄 Loaded input messages (${messageLines.split('\n').length} messages)`)
    return this.inputMessages
  }

  // Get newspaper output from existing test-output.txt file
  async getNewspaperOutput () {
    console.log('📰 Loading newspaper output from test-output.txt...')

    const outputPath = path.join(__dirname, 'test-output.txt')
    const content = fs.readFileSync(outputPath, 'utf8')

    // Extract just the final newspaper content between the markers
    const startMarker = '📰 FINAL NEWSPAPER SUMMARY'
    const endMarker = '📈 Usage:'

    const startIndex = content.indexOf(startMarker)
    const endIndex = content.indexOf(endMarker)

    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Could not find newspaper summary in test-output.txt')
    }

    // Extract the newspaper content
    const summarySection = content.substring(startIndex, endIndex)
    const lines = summarySection.split('\n')

    // Skip the header lines and get the actual content
    let contentStartIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# Daily Report:')) {
        contentStartIndex = i
        break
      }
    }

    if (contentStartIndex === -1) {
      throw new Error('Could not find start of newspaper content')
    }

    this.newspaperOutput = lines.slice(contentStartIndex).join('\n').trim()
    console.log(`📰 Loaded newspaper output (${this.newspaperOutput.length} characters)`)
    return this.newspaperOutput
  }

  // Evaluate with O1/O3 model
  async evaluateWithAI () {
    if (!this.inputMessages || !this.newspaperOutput) {
      throw new Error('Must load input messages and newspaper output first')
    }

    console.log('🤖 Sending to AI for evaluation...')

    const prompt = EVALUATION_PROMPT
      .replace('{input_messages}', this.inputMessages)
      .replace('{newspaper_output}', this.newspaperOutput)

    try {
      const response = await callOpenAI([
        {
          role: 'system',
          content: 'You are a precise fact-checking AI that returns ONLY valid JSON arrays with no extra text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], 'o3')

      const evaluationText = response.choices[0].message.content.trim()

      // Try to parse as JSON
      let evaluation
      try {
        // The response should be pure JSON
        evaluation = JSON.parse(evaluationText)
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError.message)

        // Try to save the raw response for debugging
        fs.writeFileSync('debug-response.json', evaluationText)
        console.log('💾 Saved raw response to debug-response.json')

        // Try to manually parse the saved file
        try {
          const savedContent = fs.readFileSync('debug-response.json', 'utf8')
          evaluation = JSON.parse(savedContent)
          console.log('✅ Successfully parsed JSON from saved file')
        } catch (secondError) {
          console.error('Second parsing attempt also failed:', secondError.message)
          throw new Error('AI did not return valid JSON')
        }
      }

      console.log(`✅ Evaluation complete: ${evaluation.length} issues found`)
      return evaluation
    } catch (error) {
      console.error('OpenAI API error:', error.message)
      throw error
    }
  }

  // Generate summary report
  generateReport (evaluation) {
    console.log('\n📊 EVALUATION REPORT')
    console.log('='.repeat(60))

    if (evaluation.length === 0) {
      console.log('✅ No issues found!')
      return
    }

    // Count by type
    const typeCount = {}
    const severityCount = {}

    evaluation.forEach(issue => {
      typeCount[issue.type] = (typeCount[issue.type] || 0) + 1
      severityCount[issue.severity] = (severityCount[issue.severity] || 0) + 1
    })

    console.log(`🚨 Total Issues Found: ${evaluation.length}`)
    console.log('\n📈 By Type:')
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`)
    })

    console.log('\n⚠️ By Severity:')
    Object.entries(severityCount).forEach(([severity, count]) => {
      console.log(`  - ${severity}: ${count}`)
    })

    console.log('\n🔍 Detailed Issues:')
    evaluation.forEach((issue, i) => {
      console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`)
      console.log(`   Description: ${issue.description}`)
      if (issue.input_evidence) {
        console.log(`   Input: "${issue.input_evidence}"`)
      }
      if (issue.output_evidence) {
        console.log(`   Output: "${issue.output_evidence}"`)
      }
    })

    return {
      totalIssues: evaluation.length,
      byType: typeCount,
      bySeverity: severityCount,
      issues: evaluation
    }
  }

  // Save results to file
  saveResults (evaluation, report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `evaluation-results-${timestamp}.json`

    const results = {
      timestamp: new Date().toISOString(),
      summary: report,
      detailed_issues: evaluation,
      input_message_count: this.inputMessages.split('\n').length,
      output_length: this.newspaperOutput.length
    }

    fs.writeFileSync(filename, JSON.stringify(results, null, 2))
    console.log(`\n💾 Results saved to: ${filename}`)
  }
}

// CLI Interface
async function main () {
  console.log('🧪 NEWSPAPER OUTPUT EVALUATOR')
  console.log('Using O1/O3 model for objective fact-checking analysis')

  try {
    const evaluator = new NewspaperEvaluator()

    // Load input and generate output
    evaluator.loadInputMessages()
    await evaluator.getNewspaperOutput()

    // Get AI evaluation
    const evaluation = await evaluator.evaluateWithAI()

    // Generate and display report
    const report = evaluator.generateReport(evaluation)

    // Save results
    evaluator.saveResults(evaluation, report)

    // Exit with error code if issues found
    process.exit(evaluation.length > 0 ? 1 : 0)
  } catch (error) {
    console.error('❌ Evaluation failed:', error.message)
    process.exit(1)
  }
}

// Export for programmatic use
module.exports = { NewspaperEvaluator, EVALUATION_PROMPT }

// Run if called directly
if (require.main === module) {
  main()
}
