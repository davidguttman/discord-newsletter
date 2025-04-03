const mongoose = require('mongoose')
const deasync = require('deasync')
const config = require('../../config')

let db = null

mongoose.connect(config.mongoUri + config.mongoDbName)
  .then((connection) => {
    db = connection
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })

// Wait for connection
deasync.loopWhile(() => !db)

// Add health check method
mongoose.checkHealth = function () {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    this.connection.db.admin().ping((err) => {
      if (err) {
        reject(err)
        return
      }
      const duration = Date.now() - start
      resolve({ duration })
    })
  })
}

module.exports = mongoose 