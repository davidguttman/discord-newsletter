const test = require('tape')
const request = require('supertest')
const Message = require('../../models/message')
const email = require('../../lib/email')

// Set test environment before requiring app
process.env.NODE_ENV = 'test'
const app = require('../../server')

// Create a spy for email.sendEmail
const originalSendEmail = email.sendEmail
let emailSent = false
let lastEmailOptions = null

email.sendEmail = async (options) => {
  emailSent = true
  lastEmailOptions = options
  return { id: 'test-email-id', message: 'Test email sent', status: 'success' }
}

// Reset spy before each test
test.onFinish(() => {
  email.sendEmail = originalSendEmail
})

test('POST /email-summary/channel/:channelId - requires to parameter', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ since: '1d' })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Email recipient (to)'))
  t.end()
})

test('POST /email-summary/channel/:channelId - requires since parameter', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ to: 'test@example.com' })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Time period (since)'))
  t.end()
})

test('POST /email-summary/channel/:channelId - validates since format', async t => {
  const response = await request(app)
    .post('/email-summary/channel/channel1')
    .send({ to: 'test@example.com', since: 'invalid' })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 400)
  t.ok(response.body.error.includes('Invalid time period format'))
  t.end()
})

test('POST /email-summary/channel/:channelId - returns 404 when no messages found', async t => {
  const response = await request(app)
    .post('/email-summary/channel/nonexistent')
    .send({ to: 'test@example.com', since: '1d' })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 404)
  t.end()
})

test('POST /email-summary/channel/:channelId - sends email summary', async t => {
  // Reset spy state
  emailSent = false
  lastEmailOptions = null

  // Create some test messages
  const messages = [
    {
      id: 'email1',
      content: 'test message 1',
      authorId: 'user1',
      authorUsername: 'testuser1',
      channelId: 'channel-email',
      guildId: 'guild1',
      createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 60),
      attachments: [],
      embeds: []
    },
    {
      id: 'email2',
      content: 'test message 2',
      authorId: 'user2',
      authorUsername: 'testuser2',
      channelId: 'channel-email',
      guildId: 'guild1',
      createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 30),
      attachments: [],
      embeds: []
    }
  ]

  await Message.insertMany(messages)

  const response = await request(app)
    .post('/email-summary/channel/channel-email')
    .send({
      to: 'test@example.com',
      since: '2h',
      format: 'html'
    })
    .set('Authorization', 'Bearer test-token')

  t.equal(response.status, 200)
  t.equal(response.body.success, true)
  t.equal(response.body.channelId, 'channel-email')
  t.equal(response.body.to, 'test@example.com')
  t.equal(response.body.messageCount, 2)
  t.equal(response.body.emailId, 'test-email-id')

  t.ok(emailSent, 'Email was sent')
  t.equal(lastEmailOptions.to, 'test@example.com', 'Email sent to correct recipient')
  t.ok(lastEmailOptions.subject.includes('Discord Channel Summary'), 'Email has correct subject')
  t.ok(lastEmailOptions.html, 'HTML content was included')
  t.ok(lastEmailOptions.text, 'Text content was included')

  t.end()
})
