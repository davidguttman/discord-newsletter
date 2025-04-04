const test = require('tape')
const request = require('supertest')
const Message = require('../../models/message')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

test('GET /messages - returns empty list when no messages', async t => {
  const response = await request(app).get('/messages')
  t.equal(response.status, 200)
  t.equal(response.body.messages.length, 0)
  t.equal(response.body.pagination.total, 0)
  t.end()
})

test('GET /messages - returns messages with pagination', async t => {
  // Create some test messages
  const messages = [
    {
      id: '1',
      content: 'test message 1',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel1',
      guildId: 'guild1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: '2',
      content: 'test message 2',
      authorId: 'user2',
      authorUsername: 'testuser2',
      channelId: 'channel1',
      guildId: 'guild1',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02')
    },
    {
      id: '3',
      content: 'test message 3',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel2',
      guildId: 'guild1',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-03')
    }
  ]

  await Message.insertMany(messages)

  // Test pagination
  const response = await request(app).get('/messages?page=1&limit=2')
  t.equal(response.status, 200)
  t.equal(response.body.messages.length, 2)
  t.equal(response.body.pagination.total, 3)
  t.equal(response.body.pagination.pages, 2)

  // Test filtering by guild
  const guildResponse = await request(app).get('/messages?guildId=guild1')
  t.equal(guildResponse.status, 200)
  t.equal(guildResponse.body.messages.length, 3)

  // Test filtering by channel
  const channelResponse = await request(app).get('/messages?channelId=channel1')
  t.equal(channelResponse.status, 200)
  t.equal(channelResponse.body.messages.length, 2)

  // Test filtering by author
  const authorResponse = await request(app).get('/messages?authorId=user1')
  t.equal(authorResponse.status, 200)
  t.equal(authorResponse.body.messages.length, 2)

  // Test date filtering
  const dateResponse = await request(app)
    .get('/messages?startDate=2024-01-01&endDate=2024-01-02')
  t.equal(dateResponse.status, 200)
  t.equal(dateResponse.body.messages.length, 2)

  t.end()
})

test('GET /messages/:id - returns single message', async t => {
  const message = await Message.findOne({ id: '1' })
  const response = await request(app).get(`/messages/${message.id}`)
  t.equal(response.status, 200)
  t.equal(response.body.content, 'test message 1')
  t.end()
})

test('GET /messages/:id - returns 404 for non-existent message', async t => {
  const response = await request(app).get('/messages/nonexistent')
  t.equal(response.status, 404)
  t.end()
})

test('GET /messages/thread/:threadId - returns thread messages', async t => {
  // Create a thread message
  await Message.create({
    id: '4',
    content: 'thread message',
    authorId: 'user1',
    authorUsername: 'testuser1',
    channelId: 'thread1',
    guildId: 'guild1',
    threadId: 'thread1',
    parentId: 'channel1',
    createdAt: new Date(),
    updatedAt: new Date()
  })

  const response = await request(app).get('/messages/thread/thread1')
  t.equal(response.status, 200)
  t.equal(response.body.messages.length, 1)
  t.equal(response.body.messages[0].content, 'thread message')
  t.end()
})
