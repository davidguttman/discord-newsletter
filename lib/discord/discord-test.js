// Mock Discord client for testing
const mockClient = {
  on: () => {},
  login: async () => {},
  destroy: async () => {}
}

async function start () {
  // No-op in test environment
}

async function stop () {
  // No-op in test environment
}

module.exports = {
  start,
  stop
} 