const discord = require('./lib/discord')

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await discord.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down...')
  await discord.stop()
  process.exit(0)
})

discord.start().catch(err => {
  console.error('Failed to start:', err)
  process.exit(1)
}) 