const test = require('tape')
const { findMessageByType } = require('../helpers/fixtures')

test('Basic Messages - plain text', t => {
  const message = findMessageByType('plainText')
  t.equal(message.raw.content, 'plain text message', 'content matches')
  t.equal(message.raw.mentions.users.length, 0, 'no mentions')
  t.equal(message.raw.attachments.length, 0, 'no attachments')
  t.equal(message.raw.embeds.length, 0, 'no embeds')
  t.end()
})

test('Basic Messages - mentions', t => {
  const userMention = findMessageByType('userMention')
  t.equal(userMention.raw.mentions.users.length, 1, 'has one user mention')
  t.equal(userMention.raw.mentions.users[0].id, '367727560869675018', 'correct user id')

  const roleMention = findMessageByType('roleMention')
  t.ok(roleMention.raw.content.includes('<@&1014398560625754154>'), 'has role mention')

  const channelMention = findMessageByType('channelMention')
  t.ok(channelMention.raw.content.includes('<#1014254487898177668>'), 'has channel mention')
  t.end()
})

test('Basic Messages - emoji', t => {
  const customEmoji = findMessageByType('customEmoji')
  t.ok(customEmoji.raw.content.includes('<a:megaman:724460090618282063>'), 'has custom emoji')

  const standardEmoji = findMessageByType('standardEmoji')
  t.ok(standardEmoji.raw.content.includes('⚡'), 'has standard emoji')
  t.end()
})

test('Basic Messages - formatting', t => {
  const markdown = findMessageByType('markdown')
  t.ok(markdown.raw.content.includes('**message**'), 'has bold')
  t.ok(markdown.raw.content.includes('`with`'), 'has code')
  t.ok(markdown.raw.content.includes('_markdown_'), 'has italic')

  const paragraphs = findMessageByType('multipleParagraphs')
  t.ok(paragraphs.raw.content.split('\n\n').length > 1, 'has multiple paragraphs')
  t.end()
})

test('Basic Messages - URLs and embeds', t => {
  const url = findMessageByType('url')
  t.ok(url.raw.content.includes('https://david.app'), 'has URL')
  t.equal(url.raw.embeds.length, 1, 'has embed')
  t.equal(url.raw.embeds[0].type, 'rich', 'is rich embed')
  t.equal(url.raw.embeds[0].title, 'Misc . David Guttman . com', 'correct embed title')
  t.end()
})
