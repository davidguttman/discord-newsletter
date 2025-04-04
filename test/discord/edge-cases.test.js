const test = require('tape')
const { findMessageByType } = require('../helpers/fixtures')

test('Edge Cases - empty message', t => {
  const message = findMessageByType('emptyMessage')
  t.equal(message.raw.content, '', 'content is empty')
  t.equal(message.raw.channel.isThread, true, 'is in thread')
  t.ok(message.raw.reference, 'has reference')
  t.end()
})

test('Edge Cases - edited message', t => {
  const message = findMessageByType('edited')
  t.ok(message.raw.editedAt, 'has edit timestamp')
  t.notEqual(message.raw.createdAt, message.raw.editedAt, 'edit time differs from creation')
  t.equal(message.raw.content, 'message edit: this is the edit', 'has edited content')
  t.end()
})

test('Edge Cases - link preview embed', t => {
  const message = findMessageByType('url')
  t.ok(message.raw.embeds.length > 0, 'has embeds')
  const embed = message.raw.embeds[0]
  t.equal(embed.type, 'rich', 'is rich embed')
  t.ok(embed.title, 'has title')
  t.ok(embed.description, 'has description')
  t.ok(embed.url, 'has url')
  t.ok(embed.thumbnail, 'has thumbnail')
  t.end()
})
