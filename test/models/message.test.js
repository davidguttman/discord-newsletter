const test = require('tape')
const Message = require('../../models/message')

test('save basic message', async t => {
  const messageData = {
    id: '123',
    content: 'test message',
    authorId: '456',
    authorUsername: 'testuser',
    channelId: '789',
    guildId: '012',
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    embeds: []
  }

  await Message.create(messageData)
  const saved = await Message.findOne({ id: '123' })

  t.equal(saved.content, 'test message', 'message content saved')
  t.equal(saved.authorId, '456', 'author id saved')
  t.equal(saved.channelId, '789', 'channel id saved')
  t.equal(saved.guildId, '012', 'guild id saved')
  t.equal(saved.threadId, null, 'thread id is null for non-thread messages')
  t.equal(saved.replyToId, null, 'replyToId is null for non-reply messages')
  t.equal(saved.mentionsReplyTarget, false, 'mentionsReplyTarget is false for non-reply messages')

  t.end()
})

test('save message with thread', async t => {
  const messageData = {
    id: '234',
    content: 'thread message',
    authorId: '456',
    authorUsername: 'testuser',
    channelId: '567',
    guildId: '012',
    threadId: '567',
    parentId: '789',
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    embeds: []
  }

  await Message.create(messageData)
  const saved = await Message.findOne({ id: '234' })

  t.equal(saved.content, 'thread message', 'message content saved')
  t.equal(saved.threadId, '567', 'thread id saved')
  t.equal(saved.parentId, '789', 'parent id saved')
  t.equal(saved.channelId, '567', 'channel id matches thread id')
  t.equal(saved.replyToId, null, 'replyToId is null for non-reply thread messages')

  t.end()
})

test('save message with reply', async t => {
  const messageData = {
    id: '345',
    content: 'reply message',
    authorId: '456',
    authorUsername: 'testuser',
    channelId: '789',
    guildId: '012',
    replyToId: '123',
    mentionsReplyTarget: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    embeds: []
  }

  await Message.create(messageData)
  const saved = await Message.findOne({ id: '345' })

  t.equal(saved.content, 'reply message', 'message content saved')
  t.equal(saved.replyToId, '123', 'replyToId saved')
  t.equal(saved.mentionsReplyTarget, true, 'mentionsReplyTarget saved')
  t.equal(saved.threadId, null, 'thread id is null for reply messages')

  t.end()
})

test('save message with attachments', async t => {
  const messageData = {
    id: '456',
    content: 'message with attachments',
    authorId: '456',
    authorUsername: 'testuser',
    channelId: '789',
    guildId: '012',
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [{
      id: '789',
      url: 'https://example.com/image.png',
      name: 'image.png',
      size: 1024
    }],
    embeds: []
  }

  await Message.create(messageData)
  const saved = await Message.findOne({ id: '456' })

  t.equal(saved.attachments.length, 1, 'attachment saved')
  t.equal(saved.attachments[0].id, '789', 'attachment id saved')
  t.equal(saved.attachments[0].url, 'https://example.com/image.png', 'attachment url saved')
  t.equal(saved.attachments[0].name, 'image.png', 'attachment name saved')
  t.equal(saved.attachments[0].size, 1024, 'attachment size saved')

  t.end()
})

test('save message with embeds', async t => {
  const messageData = {
    id: '567',
    content: 'message with embeds',
    authorId: '456',
    authorUsername: 'testuser',
    channelId: '789',
    guildId: '012',
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    embeds: [{
      type: 'rich',
      title: 'Test Embed',
      description: 'Test Description',
      url: 'https://example.com'
    }]
  }

  await Message.create(messageData)
  const saved = await Message.findOne({ id: '567' })

  t.equal(saved.embeds.length, 1, 'embed saved')
  t.equal(saved.embeds[0].type, 'rich', 'embed type saved')
  t.equal(saved.embeds[0].title, 'Test Embed', 'embed title saved')
  t.equal(saved.embeds[0].description, 'Test Description', 'embed description saved')
  t.equal(saved.embeds[0].url, 'https://example.com', 'embed url saved')

  t.end()
})
