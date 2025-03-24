const { MongoClient } = require('mongodb')
const config = require('../config')

let client
let db

async function connect () {
  if (client) return client

  client = new MongoClient(config.mongoUri)
  await client.connect()
  db = client.db()

  return client
}

async function disconnect () {
  if (!client) return
  await client.close()
  client = null
  db = null
}

async function saveMessage (message) {
  if (!db) await connect()

  const collection = db.collection('messages')
  
  const messageData = {
    id: message.id,
    content: message.content,
    authorId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channel.id,
    guildId: message.guild?.id,
    threadId: message.channel.isThread() ? message.channel.id : null,
    parentId: message.channel.isThread() ? message.channel.parentId : null,
    createdAt: message.createdAt,
    updatedAt: message.editedAt || message.createdAt,
    replyToId: message.reference?.messageId || null,
    mentionsReplyTarget: message.mentions?.repliedUser || false,
    attachments: message.attachments.map(a => ({
      id: a.id,
      url: a.url,
      name: a.name,
      size: a.size
    })),
    embeds: message.embeds.map(e => ({
      type: e.type,
      title: e.title,
      description: e.description,
      url: e.url
    }))
  }

  const result = await collection.updateOne(
    { id: message.id },
    { $set: messageData },
    { upsert: true }
  )

  return {
    messageId: message.id,
    wasUpdated: result.matchedCount > 0,
    wasInserted: result.upsertedCount > 0
  }
}

module.exports = {
  connect,
  disconnect,
  saveMessage
} 