// Export test or production OpenAI client based on environment
module.exports = process.env.NODE_ENV === 'test'
  ? require('./openai-test')
  : require('./openai')
