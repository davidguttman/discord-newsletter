const test = require('tape')
const { generateEmailHTML, sendEmail } = require('../scripts/send-newsletter')

// Set up test environment
process.env.NODE_ENV = 'test'

// Mock globals required by send-newsletter.js
global.EMAIL_FROM = 'test@example.com'
global.EMAIL_TO = ['recipient@example.com']

// Mock data for tests
const mockMessages = [
  {
    content: 'Test message 1',
    author: 'user1',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    channelId: 'channel1',
    channelName: 'general',
    url: 'https://discord.com/channels/guild/channel1/msg1',
    reactions: []
  },
  {
    content: 'Test message 2',
    author: 'user2',
    timestamp: new Date('2024-01-01T11:00:00Z'),
    channelId: 'channel1',
    channelName: 'general',
    url: 'https://discord.com/channels/guild/channel1/msg2',
    reactions: [{ emoji: '👍', count: 2 }]
  },
  {
    content: 'Test message 3',
    author: 'user1',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    channelId: 'channel2',
    channelName: 'announcements',
    url: 'https://discord.com/channels/guild/channel2/msg3',
    reactions: []
  }
]

test('generateEmailHTML - uses channel names instead of IDs', t => {
  const since = new Date('2024-01-01T09:00:00Z')
  const html = generateEmailHTML(mockMessages, since)
  
  t.ok(html.includes('Channel: #general'), 'includes general channel name')
  t.ok(html.includes('Channel: #announcements'), 'includes announcements channel name')
  t.notOk(html.includes('Channel: #channel1'), 'does not use channel IDs')
  t.notOk(html.includes('Channel: #channel2'), 'does not use channel IDs')
  
  t.end()
})

test('sendEmail - uses channel names in subject', async t => {
  // Set up test
  const consoleLog = console.log
  let capturedLog = ''
  console.log = (message, data) => {
    if (message === '[TEST] Email would be sent with data:') {
      capturedLog = JSON.stringify(data)
    }
  }
  
  const since = new Date('2024-01-01T09:00:00Z')
  const html = '<html><body>Test</body></html>'
  const channelNames = ['general', 'announcements']
  
  await sendEmail(html, since, channelNames)
  
  // Restore console.log
  console.log = consoleLog
  
  t.ok(capturedLog.includes('#general'), 'subject includes general channel name')
  t.ok(capturedLog.includes('#announcements'), 'subject includes announcements channel name')
  
  t.end()
})