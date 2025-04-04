const test = require('tape')
const request = require('supertest')
const Message = require('../../models/message')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

test('GET /summarize/channel/:channelId - returns 400 without date range', async t => {
  const response = await request(app)
    .get('/summarize/channel/channel1')
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 400)
  t.ok(response.body.error.includes('startDate and endDate'))
  t.end()
})

test('GET /summarize/channel/:channelId - returns 404 when no messages found', async t => {
  const response = await request(app)
    .get('/summarize/channel/nonexistent')
    .query({
      startDate: '2023-01-01',
      endDate: '2023-01-02'
    })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 404)
  t.end()
})

test('GET /summarize/channel/:channelId - returns summary of messages', async t => {
  // Create some test messages
  const messages = [
    {
      id: 'sum1',
      content: 'test message 1',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel-summary',
      guildId: 'guild1',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      attachments: [],
      embeds: []
    },
    {
      id: 'sum2',
      content: 'test message 2',
      authorId: 'user2',
      authorUsername: 'testuser2',
      channelId: 'channel-summary',
      guildId: 'guild1',
      createdAt: new Date('2024-01-01T10:05:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      attachments: [],
      embeds: []
    }
  ]

  await Message.insertMany(messages)

  const response = await request(app)
    .get('/summarize/channel/channel-summary')
    .query({
      startDate: '2024-01-01',
      endDate: '2024-01-02'
    })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 200)
  t.equal(response.body.channelId, 'channel-summary')
  t.equal(response.body.messageCount, 2)
  t.ok(response.body.summary, 'Has summary text')
  t.ok(response.body.usage, 'Has token usage information')
  t.end()
})
