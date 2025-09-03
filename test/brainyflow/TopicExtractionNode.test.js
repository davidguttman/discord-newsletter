const test = require('tape')
const TopicExtractionNode = require('../../lib/brainyflow/nodes/TopicExtractionNode')
const { createDiscordMemory } = require('../../lib/brainyflow/utils')

test('TopicExtractionNode - successful topic extraction', async (t) => {
  const node = new TopicExtractionNode()
  const memory = createDiscordMemory({
    options: { debug: false }
  })
  memory.formattedMessages = 'Test conversation about AI and blockchain topics'
  memory.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // Mock the OpenAI response
  const mockTopicsResponse = JSON.stringify({
    topics: [
      {
        id: 'ai-discussion',
        description: 'Discussion about artificial intelligence',
        substance: 4,
        category: 'technology'
      },
      {
        id: 'blockchain-talk',
        description: 'Blockchain and cryptocurrency talk',
        substance: 3,
        category: 'technology'
      }
    ]
  })

  try {
    // Test prep phase
    const prepResult = await node.prep(memory)
    t.equal(prepResult.formattedMessages, 'Test conversation about AI and blockchain topics', 'prep returns formatted messages')
    t.ok(prepResult.model, 'prep returns model')

    // Test exec phase - we'll mock this since we don't want to call real OpenAI in tests
    const mockExecResult = {
      response: mockTopicsResponse,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    }

    // Test post phase
    await node.post(memory, prepResult, mockExecResult)
    t.equal(memory.topics.length, 2, 'post stores correct number of topics')
    t.equal(memory.topics[0].description, 'Discussion about artificial intelligence', 'post stores correct topic description')
    t.equal(memory.usage.total_tokens, 150, 'post accumulates usage statistics')
    t.equal(memory.metadata.topicsFound, 2, 'post sets metadata topics count')

    t.pass('TopicExtractionNode completed successfully')
  } catch (error) {
    t.fail(`TopicExtractionNode failed: ${error.message}`)
  }

  t.end()
})

test('TopicExtractionNode - handles JSON parsing error', async (t) => {
  const node = new TopicExtractionNode()
  const memory = createDiscordMemory({
    options: { debug: false }
  })
  memory.formattedMessages = 'Test conversation'
  memory.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // Invalid JSON response
  const invalidJsonResponse = 'Invalid JSON { topics: ['

  try {
    const prepResult = await node.prep(memory)
    const mockExecResult = {
      response: invalidJsonResponse,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    }

    // Mock the fixJsonResponse method to simulate the fix attempt
    node.fixJsonResponse = async () => [{
      id: 'general-discussion',
      description: 'General channel discussion and activity',
      substance: 3,
      category: 'general'
    }]

    await node.post(memory, prepResult, mockExecResult)
    t.equal(memory.topics.length, 1, 'post handles JSON error and creates fallback topic')
    t.equal(memory.topics[0].id, 'general-discussion', 'post creates correct fallback topic')

    t.pass('TopicExtractionNode handles JSON parsing error')
  } catch (error) {
    t.fail(`TopicExtractionNode failed: ${error.message}`)
  }

  t.end()
})

test('TopicExtractionNode - handles no substantial topics', async (t) => {
  const node = new TopicExtractionNode()
  const memory = createDiscordMemory({
    options: { debug: false }
  })
  memory.formattedMessages = 'Test conversation'
  memory.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // Response with no substantial topics (substance < 1)
  const mockTopicsResponse = JSON.stringify({
    topics: [
      {
        id: 'weak-topic',
        description: 'Very weak discussion',
        substance: 0,
        category: 'general'
      }
    ]
  })

  try {
    const prepResult = await node.prep(memory)
    const mockExecResult = {
      response: mockTopicsResponse,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    }

    await node.post(memory, prepResult, mockExecResult)
    t.equal(memory.topics.length, 1, 'post creates fallback topic when no substantial topics')
    t.equal(memory.topics[0].id, 'general-discussion', 'post creates correct general topic')
    t.equal(memory.topics[0].substance, 3, 'post sets correct substance for general topic')

    t.pass('TopicExtractionNode handles no substantial topics')
  } catch (error) {
    t.fail(`TopicExtractionNode failed: ${error.message}`)
  }

  t.end()
})

test('TopicExtractionNode - missing formatted messages', async (t) => {
  const node = new TopicExtractionNode()
  const memory = createDiscordMemory({
    options: { debug: false }
  })
  // Missing formattedMessages

  try {
    await node.prep(memory)
    t.fail('Should have thrown error for missing formatted messages')
  } catch (error) {
    t.ok(error.message.includes('formattedMessages is required'), 'throws correct error message')
  }

  t.end()
})
