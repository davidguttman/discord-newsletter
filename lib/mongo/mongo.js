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

    // Check connection state
    if (this.connection.readyState !== 1) {
      reject(new Error(`MongoDB not connected, state: ${this.connection.readyState}`))
      return
    }

    // If connected, immediately resolve
    const duration = Date.now() - start
    resolve({
      duration,
      state: this.connection.readyState,
      status: 'connected'
    })
  })
}

module.exports = mongoose
