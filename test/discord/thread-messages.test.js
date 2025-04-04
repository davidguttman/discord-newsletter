const test = require('tape')
const { findMessageByType } = require('../helpers/fixtures')

test('Thread Messages - thread starter', t => {
  const message = findMessageByType('threadStarter')
  t.equal(message.raw.channel.isThread, false, 'not in thread')
  t.equal(message.raw.channel.parentId, null, 'no parent id')
  t.end()
})

test('Thread Messages - regular message in thread', t => {
  const message = findMessageByType('threadMessage')
  t.equal(message.raw.channel.isThread, true, 'is in thread')
  t.ok(message.raw.channel.parentId, 'has parent id')
  t.equal(message.raw.content, 'regular message in thread', 'correct content')
  t.end()
})

test('Thread Messages - empty message in thread', t => {
  // This is the empty message that was created when starting the thread
  const message = findMessageByType('emptyMessage')
  t.equal(message.raw.channel.isThread, true, 'is in thread')
  t.ok(message.raw.channel.parentId, 'has parent id')
  t.equal(message.raw.content, '', 'empty content')
  t.ok(message.raw.reference, 'has reference')
  t.equal(message.raw.reference.messageId, findMessageByType('threadStarter').raw.id, 'references thread starter')
  t.end()
})
