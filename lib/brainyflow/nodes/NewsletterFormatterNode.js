// NewsletterFormatterNode - Formats stories into final newsletter format

const { Node } = require('brainyflow')
const { debugLog, deduplicateUrls } = require('../utils')

class NewsletterFormatterNode extends Node {
  async prep (memory) {
    const { stories, catchallStory, options } = memory

    if (!stories || stories.length === 0) {
      throw new Error('NewsletterFormatterNode: stories are required')
    }

    debugLog(
      '📰 NewsletterFormatterNode: Assembling final newsletter...',
      'assembly-start',
      options.debug ? memory.debugSteps : null
    )

    return { stories, catchallStory, options }
  }

  async exec ({ stories, catchallStory, options }) {
    // Assemble the final newsletter
    let finalSummary = '# Daily Report: #channel\n\n'

    // Add main stories
    const mainStoriesContent = stories.map(s => s.content).join('\n\n')
    finalSummary += mainStoriesContent

    // Add catchall story if it has substantial content
    if (catchallStory && catchallStory.trim() !== 'No additional highlights to report.') {
      finalSummary += '\n\n' + catchallStory
    }

    return finalSummary
  }

  async post (memory, prepResult, execResult) {
    let finalSummary = execResult
    const { options } = memory

    // Post-process to remove duplicate URLs
    const { cleanedText, duplicatesRemoved } = deduplicateUrls(finalSummary)
    finalSummary = cleanedText

    // Store final summary in memory
    memory.summary = finalSummary

    debugLog(
      `✅ NewsletterFormatterNode: Newsletter complete. Generated ${memory.stories.length} main stories + catchall using ${memory.usage.total_tokens} tokens`,
      'complete',
      options.debug ? memory.debugSteps : null
    )

    debugLog(
      `🔧 NewsletterFormatterNode: Post-processing: removed ${duplicatesRemoved} duplicate URLs`,
      'deduplication',
      options.debug ? memory.debugSteps : null
    )

    // Update metadata
    memory.metadata.passes = 4
    memory.metadata.duplicateUrlsRemoved = duplicatesRemoved
    memory.metadata.approach = 'brainyflow-multi-pass-with-catchall'
  }
}

module.exports = NewsletterFormatterNode
