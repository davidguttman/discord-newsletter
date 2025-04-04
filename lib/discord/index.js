// Export test or production Discord client based on environment
module.exports = process.env.NODE_ENV === 'test'
  ? require('./discord-test')
  : require('./discord')
