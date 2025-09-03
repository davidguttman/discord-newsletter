// MessageFetchNode - Fetches Discord messages from MongoDB

const { Node } = require('brainyflow')
const { calculateDateRange, fetchChannelMessages, formatMessagesForAI, debugLog } = require('../utils')

class MessageFetchNode extends Node {
  async prep (memory) {
    // Extract parameters from memory
    const { guildId, channelId, since, options } = memory

    if (!guildId || !channelId) {
      throw new Error('MessageFetchNode: guildId and channelId are required')
    }

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(since)
    memory.startDate = startDate
    memory.endDate = endDate

    debugLog(
      `📥 MessageFetchNode: Fetching messages for ${guildId}:${channelId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      'message-fetch-start',
      options.debug ? memory.debugSteps : null
    )

    return { guildId, channelId, startDate, endDate }
  }

  async exec ({ guildId, channelId, startDate, endDate }) {
    // Fetch messages from MongoDB
    const messages = await fetchChannelMessages(guildId, channelId, startDate, endDate)

    if (messages.length === 0) {
      throw new Error(`No messages found for channel ${channelId} in the specified time range`)
    }

    return messages
  }

  async post (memory, prepResult, execResult) {
    const messages = execResult
    const { options } = memory

    // Store messages in memory
    memory.messages = messages

    // Format messages for AI processing
    memory.formattedMessages = formatMessagesForAI(messages)

    debugLog(
      `📝 MessageFetchNode: Retrieved ${messages.length} messages (${memory.formattedMessages.length} chars)`,
      'message-fetch-complete',
      options.debug ? memory.debugSteps : null
    )

    // Initialize metadata
    if (!memory.metadata) {
      memory.metadata = {}
    }
    memory.metadata.messageCount = messages.length
    memory.metadata.messagesLength = memory.formattedMessages.length
  }
}

module.exports = MessageFetchNode
