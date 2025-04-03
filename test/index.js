const test = require('tape')
const cleanup = require('./helpers/cleanup') // Import cleanup to ensure it's registered

// Run all tests
require('./api/health.test')
require('./api/widgets.test')
require('./auth.test')
require('./auto-catch.test')
require('./mongo.test')

// Cleanup after all tests
test(function(t) {
  cleanup()
  t.end()
}) 