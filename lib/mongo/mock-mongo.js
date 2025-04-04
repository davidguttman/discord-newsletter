const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

let mongoServer
MongoMemoryServer.create().then(m => { mongoServer = m })
require('deasync').loopWhile(() => !mongoServer)

let db
mongoose.connect(mongoServer.getUri(), { dbName: 'test' }).then(m => { db = m })
require('deasync').loopWhile(() => !db)

mongoose.checkHealth = async function () {
  const startTime = Date.now()
  const { db } = mongoose.connection

  const collection = db.collection('healthcheck')

  const query = { _id: 'heartbeat' }
  const value = { $set: { time: startTime } }
  try {
    await collection.updateOne(query, value, { upsert: true })
  } catch (err) {
    console.error('Error updating heartbeat', err)
  }

  try {
    const found = await collection.findOne({ time: { $gte: startTime } })
    if (!found) throw new Error('DB Healthcheck Failed')
    return {
      ok: true,
      duration: Date.now() - startTime
    }
  } catch (err) {
    console.error('Error checking heartbeat', err)
    throw err
  }
}

mongoose.mongoServer = mongoServer

mongoose.cleanup = async function () {
  await mongoose.disconnect()
  await mongoServer.stop()
}

module.exports = mongoose
