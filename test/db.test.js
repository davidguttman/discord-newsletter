const test = require('tape')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { MongoClient } = require('mongodb')

// Load test environment variables
process.env.NODE_ENV = 'test'
require('dotenv').config({ path: '.env.test' })

const config = require('../config')
const db = require('../lib/db')

let mongod

test('setup', async t => {
  mongod = await MongoMemoryServer.create()
  config.mongoUri = mongod.getUri()
  config.guildChannels = [
    { guildId: '012', channelId: '789' }
  ]
  t.end()
})

test('saveMessage', async t => {
  const message = {
    id: '123',
    content: 'test message',
    author: {
      id: '456',
      username: 'testuser'
    },
    channel: {
      id: '789',
      isThread: () => false
    },
    guild: { id: '012' },
    createdAt: new Date(),
    editedAt: null,
    attachments: [],
    embeds: []
  }

  await db.saveMessage(message)

  const client = await MongoClient.connect(config.mongoUri)
  const collection = client.db().collection('messages')
  const saved = await collection.findOne({ id: '123' })

  t.equal(saved.content, 'test message', 'message content saved')
  t.equal(saved.authorId, '456', 'author id saved')
  t.equal(saved.channelId, '789', 'channel id saved')
  t.equal(saved.guildId, '012', 'guild id saved')
  t.equal(saved.threadId, null, 'thread id is null for non-thread messages')

  await client.close()
  t.end()
})

test('saveMessage with thread', async t => {
  const message = {
    id: '234',
    content: 'thread message',
    author: {
      id: '456',
      username: 'testuser'
    },
    channel: {
      id: '567',
      parentId: '789',
      isThread: () => true
    },
    guild: { id: '012' },
    createdAt: new Date(),
    editedAt: null,
    attachments: [],
    embeds: []
  }

  await db.saveMessage(message)

  const client = await MongoClient.connect(config.mongoUri)
  const collection = client.db().collection('messages')
  const saved = await collection.findOne({ id: '234' })

  t.equal(saved.content, 'thread message', 'message content saved')
  t.equal(saved.threadId, '567', 'thread id saved')
  t.equal(saved.parentId, '789', 'parent id saved')

  await client.close()
  t.end()
})

test('cleanup', async t => {
  await db.disconnect()
  await mongod.stop()
  t.end()
}) 