const test = require('tape')
const MessageFetchNode = require('../../lib/brainyflow/nodes/MessageFetchNode')
const { createDiscordMemory } = require('../../lib/brainyflow/utils')
const Message = require('../../models/message')

// Mock message data
const mockMessages = [
  {
    _id: '1',
    guildId: 'test-guild',
    channelId: 'test-channel',
    authorId: 'user1',
    authorUsername: 'testuser1',
    content: 'Hello world',
    createdAt: new Date('2024-01-01T10:00:00Z')
  },
  {
    _id: '2',
    guildId: 'test-guild',
    channelId: 'test-channel',
    authorId: 'user2',
    authorUsername: 'testuser2',
    content: 'How are you?',
    createdAt: new Date('2024-01-01T11:00:00Z')
  }
]

test('MessageFetchNode - successful message fetch', async (t) => {
  const node = new MessageFetchNode()
  const memory = createDiscordMemory({
    guildId: 'test-guild',
    channelId: 'test-channel',
    since: '24h'
  })

  // Mock Message.find to return our test messages
  const originalFind = Message.find
  Message.find = () => ({
    sort: () => Promise.resolve(mockMessages)
  })

  try {
    // Test prep phase
    const prepResult = await node.prep(memory)
    t.ok(prepResult.guildId, 'prep returns guildId')
    t.ok(prepResult.channelId, 'prep returns channelId')
    t.ok(prepResult.startDate, 'prep returns startDate')
    t.ok(prepResult.endDate, 'prep returns endDate')

    // Test exec phase
    const execResult = await node.exec(prepResult)
    t.equal(execResult.length, 2, 'exec returns correct number of messages')
    t.equal(execResult[0].content, 'Hello world', 'exec returns correct message content')

    // Test post phase
    await node.post(memory, prepResult, execResult)
    t.equal(memory.messages.length, 2, 'post stores messages in memory')
    t.ok(memory.formattedMessages, 'post creates formatted messages')
    t.equal(memory.metadata.messageCount, 2, 'post sets metadata message count')

    t.pass('MessageFetchNode completed successfully')
  } catch (error) {
    t.fail(`MessageFetchNode failed: ${error.message}`)
  } finally {
    // Restore original Message.find
    Message.find = originalFind
  }

  t.end()
})

test('MessageFetchNode - missing required parameters', async (t) => {
  const node = new MessageFetchNode()
  const memory = createDiscordMemory({
    // Missing guildId and channelId
    since: '24h'
  })

  try {
    await node.prep(memory)
    t.fail('Should have thrown error for missing parameters')
  } catch (error) {
    t.ok(error.message.includes('guildId and channelId are required'), 'throws correct error message')
  }

  t.end()
})

test('MessageFetchNode - no messages found', async (t) => {
  const node = new MessageFetchNode()
  const memory = createDiscordMemory({
    guildId: 'test-guild',
    channelId: 'test-channel',
    since: '24h'
  })

  // Mock Message.find to return empty array
  const originalFind = Message.find
  Message.find = () => ({
    sort: () => Promise.resolve([])
  })

  try {
    const prepResult = await node.prep(memory)
    await node.exec(prepResult)
    t.fail('Should have thrown error for no messages')
  } catch (error) {
    t.ok(error.message.includes('No messages found'), 'throws correct error for no messages')
  } finally {
    Message.find = originalFind
  }

  t.end()
})
