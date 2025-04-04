const test = require('tape')
const request = require('supertest')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

test('health endpoint returns 200 with uptime and timestamp', async t => {
  const res = await request(app)
    .get('/health')
    .expect(200)

  t.equal(res.body.status, 'OK', 'status is OK')
  t.ok(res.body.ts, 'timestamp is present')
  t.ok(res.body.uptime >= 0, 'uptime is present and non-negative')
  t.ok(res.body.memory, 'memory stats are present')
  t.ok(res.body.memory.rss > 0, 'memory.rss is present and positive')
  t.end()
})
