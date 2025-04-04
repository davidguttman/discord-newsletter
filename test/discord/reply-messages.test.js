const test = require('tape')
const { findMessageByType } = require('../helpers/fixtures')

test('Reply Messages - without mention', t => {
  const message = findMessageByType('replyNoMention')
  t.ok(message.raw.reference, 'has reference')
  t.equal(message.raw.reference.type, 'DEFAULT', 'is default reply')
  t.equal(message.raw.mentions.users.length, 0, 'no mentions')
  t.end()
})

test('Reply Messages - with mention', t => {
  const message = findMessageByType('replyWithMention')
  t.ok(message.raw.reference, 'has reference')
  t.equal(message.raw.mentions.users.length, 1, 'has one mention')
  t.equal(message.raw.mentions.users[0].id, '367727560869675018', 'mentions correct user')
  t.end()
})

test('Reply Messages - to bot', t => {
  const message = findMessageByType('replyToBot')
  t.ok(message.raw.reference, 'has reference')
  t.equal(message.raw.mentions.users.length, 1, 'has one mention')
  t.equal(message.raw.mentions.users[0].id, '1022295567298220062', 'mentions bot')
  t.end()
})

test('Reply Messages - to message with attachment', t => {
  const message = findMessageByType('replyToAttachment')
  t.ok(message.raw.reference, 'has reference')
  t.equal(message.raw.reference.messageId, '1357511792439328859', 'references correct message')
  t.end()
})

test('Reply Messages - to edited message', t => {
  const message = findMessageByType('replyToEdited')
  t.ok(message.raw.reference, 'has reference')
  const editedMessage = findMessageByType('edited')
  t.equal(message.raw.reference.messageId, editedMessage.raw.id, 'references edited message')
  t.ok(editedMessage.raw.editedAt, 'referenced message was edited')
  t.end()
})
