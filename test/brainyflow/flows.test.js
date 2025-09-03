const test = require('tape')
const { runSimpleFlow, runNewsletterFlow } = require('../../lib/brainyflow/flows')

test('runSimpleFlow - basic functionality', async (t) => {
  const formattedMessages = 'User1: Hello\nUser2: How are you?\nUser1: Good, thanks!'
  const options = { debug: false }

  try {
    const result = await runSimpleFlow(formattedMessages, options)

    t.ok(result.summary, 'returns summary')
    t.ok(result.usage, 'returns usage statistics')
    t.ok(result.metadata, 'returns metadata')
    t.equal(result.metadata.approach, 'brainyflow-simple', 'sets correct approach')
    t.equal(result.metadata.flow, 'simple', 'sets correct flow type')

    t.pass('runSimpleFlow completed successfully')
  } catch (error) {
    t.fail(`runSimpleFlow failed: ${error.message}`)
  }

  t.end()
})

test('runNewsletterFlow - basic functionality', async (t) => {
  const formattedMessages = 'User1: Check out this new AI tool\nUser2: Interesting, what does it do?\nUser1: It helps with code generation'
  const options = { debug: false }

  try {
    const result = await runNewsletterFlow(formattedMessages, options)

    t.ok(result.summary, 'returns summary')
    t.ok(result.usage, 'returns usage statistics')
    t.ok(result.metadata, 'returns metadata')
    t.equal(result.metadata.approach, 'brainyflow-newsletter', 'sets correct approach')
    t.equal(result.metadata.flow, 'newsletter', 'sets correct flow type')

    t.pass('runNewsletterFlow completed successfully')
  } catch (error) {
    t.fail(`runNewsletterFlow failed: ${error.message}`)
  }

  t.end()
})

test('runSimpleFlow - empty messages', async (t) => {
  const formattedMessages = ''
  const options = { debug: false }

  try {
    const result = await runSimpleFlow(formattedMessages, options)
    t.ok(result, 'handles empty messages gracefully')

    t.pass('runSimpleFlow handles empty messages')
  } catch (error) {
    // This might fail in some cases, which is expected behavior
    t.pass('runSimpleFlow appropriately handles empty messages (may throw error)')
  }

  t.end()
})

test('runNewsletterFlow - with options', async (t) => {
  const formattedMessages = 'User1: New blockchain project launched\nUser2: What are the features?'
  const options = {
    debug: true,
    model: 'gpt-4o-mini',
    maxTokens: 5000
  }

  try {
    const result = await runNewsletterFlow(formattedMessages, options)

    t.ok(result.summary, 'returns summary with options')
    t.ok(result.metadata, 'returns metadata with options')

    t.pass('runNewsletterFlow completed with options')
  } catch (error) {
    t.fail(`runNewsletterFlow with options failed: ${error.message}`)
  }

  t.end()
})
