const test = require('tape')
const config = require('../../config')
const brainyflow = require('../../lib/brainyflow')

test('BrainyFlow integration - feature flag disabled', async (t) => {
  // Temporarily disable BrainyFlow
  const originalUseBrainyFlow = config.useBrainyFlow
  config.useBrainyFlow = false

  const formattedMessages = 'User1: Hello world\nUser2: How are you?'
  const options = {}

  try {
    const result = await brainyflow.summarizeMessages(formattedMessages, options)

    t.ok(result.summary, 'returns summary when BrainyFlow disabled')
    t.ok(result.usage, 'returns usage statistics')
    t.notEqual(result.metadata?.approach, 'brainyflow-newsletter', 'uses original implementation when disabled')

    t.pass('BrainyFlow integration respects feature flag')
  } catch (error) {
    t.fail(`BrainyFlow integration failed: ${error.message}`)
  } finally {
    // Restore original setting
    config.useBrainyFlow = originalUseBrainyFlow
  }

  t.end()
})

test('BrainyFlow integration - feature flag enabled with simple flow', async (t) => {
  // Enable BrainyFlow for this test
  const originalUseBrainyFlow = config.useBrainyFlow
  config.useBrainyFlow = true

  const formattedMessages = 'User1: Testing simple flow\nUser2: This should work'
  const options = { flow: 'simple' }

  try {
    const result = await brainyflow.summarizeMessages(formattedMessages, options)

    t.ok(result.summary, 'returns summary when BrainyFlow enabled')
    t.ok(result.usage, 'returns usage statistics')
    t.equal(result.metadata.approach, 'brainyflow-simple', 'uses BrainyFlow simple flow')
    t.equal(result.metadata.flow, 'simple', 'sets correct flow type')

    t.pass('BrainyFlow integration works with simple flow')
  } catch (error) {
    t.fail(`BrainyFlow simple flow failed: ${error.message}`)
  } finally {
    config.useBrainyFlow = originalUseBrainyFlow
  }

  t.end()
})

test('BrainyFlow integration - feature flag enabled with newsletter flow', async (t) => {
  // Enable BrainyFlow for this test
  const originalUseBrainyFlow = config.useBrainyFlow
  config.useBrainyFlow = true

  const formattedMessages = 'User1: New AI development announced\nUser2: What are the implications?\nUser3: This could change everything'
  const options = {} // Default to newsletter flow

  try {
    const result = await brainyflow.summarizeMessages(formattedMessages, options)

    t.ok(result.summary, 'returns summary for newsletter flow')
    t.ok(result.usage, 'returns usage statistics')
    t.equal(result.metadata.approach, 'brainyflow-newsletter', 'uses BrainyFlow newsletter flow')
    t.equal(result.metadata.flow, 'newsletter', 'sets correct flow type')

    t.pass('BrainyFlow integration works with newsletter flow')
  } catch (error) {
    t.fail(`BrainyFlow newsletter flow failed: ${error.message}`)
  } finally {
    config.useBrainyFlow = originalUseBrainyFlow
  }

  t.end()
})

test('BrainyFlow integration - getClient compatibility', async (t) => {
  try {
    const client = brainyflow.getClient()
    t.ok(client, 'getClient returns OpenAI client')

    t.pass('BrainyFlow maintains OpenAI client compatibility')
  } catch (error) {
    t.fail(`getClient failed: ${error.message}`)
  }

  t.end()
})

test('BrainyFlow integration - configuration values', async (t) => {
  // Test that configuration values are properly set
  t.ok(typeof config.useBrainyFlow === 'boolean', 'useBrainyFlow is boolean')
  t.ok(typeof config.brainyFlowMaxVisits === 'number', 'brainyFlowMaxVisits is number')
  t.ok(typeof config.brainyFlowTimeout === 'number', 'brainyFlowTimeout is number')
  t.ok(typeof config.brainyFlowRetryCount === 'number', 'brainyFlowRetryCount is number')
  t.ok(typeof config.brainyFlowBatchSize === 'number', 'brainyFlowBatchSize is number')

  t.pass('BrainyFlow configuration is properly typed')
  t.end()
})
