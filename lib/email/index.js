// Export test or production email client based on environment
module.exports = process.env.NODE_ENV === 'test'
  ? require('./email-test')
  : require('./email')
