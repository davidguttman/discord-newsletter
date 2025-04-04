// Test version of Discord client that doesn't actually connect
async function start () {
  console.log('Test Discord client started')
}

async function stop () {
  console.log('Test Discord client stopped')
}

module.exports = {
  start,
  stop
}
