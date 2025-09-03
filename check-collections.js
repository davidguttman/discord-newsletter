#!/usr/bin/env node

const mongoose = require('./lib/mongo')

async function checkCollections () {
  try {
    await mongoose.connection

    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log('📊 MongoDB Collections:')
    console.log('═'.repeat(50))

    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments()
      console.log(`${collection.name}: ${count} documents`)
    }

    // Check messages vs rich_messages specifically
    if (collections.find(c => c.name === 'messages')) {
      const messagesSchema = await mongoose.connection.db.collection('messages').findOne()
      console.log('\n📝 Sample message document structure:')
      console.log(Object.keys(messagesSchema || {}))
    }

    if (collections.find(c => c.name === 'rich_messages')) {
      const richMessagesSchema = await mongoose.connection.db.collection('rich_messages').findOne()
      console.log('\n🌟 Sample rich_message document structure:')
      console.log(Object.keys(richMessagesSchema || {}))
    }
  } catch (error) {
    console.error('❌ Error checking collections:', error)
  } finally {
    await mongoose.connection.close()
  }
}

checkCollections()
