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

test('saveMessage basic message', async t => {
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
  t.equal(saved.replyToId, null, 'replyToId is null for non-reply messages')
  t.equal(saved.mentionsReplyTarget, false, 'mentionsReplyTarget is false for non-reply messages')

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
  t.equal(saved.channelId, '567', 'channel id matches thread id')
  t.equal(saved.replyToId, null, 'replyToId is null for non-reply thread messages')

  await client.close()
  t.end()
})

test('saveMessage with reply', async t => {
  const message = {
    id: '345',
    content: 'reply message',
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
    reference: {
      messageId: '123'
    },
    mentions: {
      repliedUser: true
    },
    attachments: [],
    embeds: []
  }

  await db.saveMessage(message)

  const client = await MongoClient.connect(config.mongoUri)
  const collection = client.db().collection('messages')
  const saved = await collection.findOne({ id: '345' })

  t.equal(saved.content, 'reply message', 'message content saved')
  t.equal(saved.replyToId, '123', 'replyToId references original message')
  t.equal(saved.mentionsReplyTarget, true, 'mentionsReplyTarget is true when reply mentions user')
  t.equal(saved.threadId, null, 'thread id is null for non-thread replies')

  await client.close()
  t.end()
})

test('saveMessage with thread reply', async t => {
  const message = {
    id: '456',
    content: 'thread reply message',
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
    reference: {
      messageId: '234'
    },
    mentions: {
      repliedUser: false
    },
    attachments: [],
    embeds: []
  }

  await db.saveMessage(message)

  const client = await MongoClient.connect(config.mongoUri)
  const collection = client.db().collection('messages')
  const saved = await collection.findOne({ id: '456' })

  t.equal(saved.content, 'thread reply message', 'message content saved')
  t.equal(saved.threadId, '567', 'thread id saved')
  t.equal(saved.parentId, '789', 'parent id saved')
  t.equal(saved.replyToId, '234', 'replyToId references original thread message')
  t.equal(saved.mentionsReplyTarget, false, 'mentionsReplyTarget is false when reply does not mention user')

  await client.close()
  t.end()
})

test('saveMessage updates existing message', async t => {
  const createdAt = new Date()
  const originalMessage = {
    id: '567',
    content: 'original content',
    author: {
      id: '456',
      username: 'testuser'
    },
    channel: {
      id: '789',
      isThread: () => false
    },
    guild: { id: '012' },
    createdAt,
    editedAt: null,
    attachments: [],
    embeds: []
  }

  const updatedMessage = {
    ...originalMessage,
    content: 'edited content',
    editedAt: new Date(createdAt.getTime() + 1000) // 1 second later
  }

  // Save original message
  const originalResult = await db.saveMessage(originalMessage)
  t.equal(originalResult.wasInserted, true, 'original message was inserted')
  t.equal(originalResult.wasUpdated, false, 'original message was not updated')

  // Update the message
  const updateResult = await db.saveMessage(updatedMessage)
  t.equal(updateResult.wasInserted, false, 'updated message was not inserted')
  t.equal(updateResult.wasUpdated, true, 'updated message was updated')

  const client = await MongoClient.connect(config.mongoUri)
  const collection = client.db().collection('messages')
  const saved = await collection.findOne({ id: '567' })

  t.equal(saved.content, 'edited content', 'message content was updated')
  t.ok(saved.updatedAt > saved.createdAt, 'updatedAt is later than createdAt')

  await client.close()
  t.end()
})

test('cleanup', async t => {
  await db.disconnect()
  await mongod.stop()
  t.end()
}) 