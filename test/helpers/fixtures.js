const fs = require('fs')
const path = require('path')

const fixturesPath = path.join(__dirname, '..', 'fixtures', 'discord-messages-2025-04-04T16-37-01-575Z.json')
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'))

// Helper to find a message by content
function findMessage (content) {
  return fixtures.find(f => f.raw.content === content)
}

// Helper to find a message by type
function findMessageByType (type) {
  const typeMap = {
    plainText: 'plain text message',
    userMention: 'user mention <@367727560869675018>',
    roleMention: 'role mention <@&1014398560625754154>',
    channelMention: 'channel mention <#1014254487898177668>',
    customEmoji: 'message with custom emoji <a:megaman:724460090618282063>',
    standardEmoji: 'message with standard emoji ⚡',
    markdown: '**message** `with` _markdown_',
    multipleParagraphs: 'message\n\nwith\n\nmultiple \n\nparagraphs',
    url: 'message with url https://david.app',
    replyNoMention: 'reply without mention',
    replyWithMention: 'reply with mention <@367727560869675018>',
    replyToBot: 'reply to bot message',
    replyToAttachment: 'reply to message with attachment',
    replyToEdited: 'reply to message that is later edited',
    threadStarter: 'thread starter message',
    threadMessage: 'regular message in thread',
    edited: 'message edit: this is the edit',
    emptyMessage: ''
  }

  const content = typeMap[type]
  if (content === undefined) throw new Error(`Unknown message type: ${type}`)
  return findMessage(content)
}

module.exports = {
  fixtures,
  findMessage,
  findMessageByType
}
