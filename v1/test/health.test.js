const test = require('tape')
const request = require('supertest')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../index')

test('health endpoint returns 200 with uptime and timestamp', async (t) => {
  try {
    const response = await request(app).get('/health')
    t.equal(response.status, 200)
    t.ok(response.body.uptime)
    t.ok(response.body.timestamp)
    t.equal(response.body.message, 'OK')
    t.end()
  } catch (err) {
    t.error(err)
    t.end()
  }
})
