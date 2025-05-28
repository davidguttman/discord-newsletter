const newsletter = require('../lib/newsletter')

async function main() {
  try {
    console.log('Initializing Discord client...')
    await newsletter.init()
    
    console.log('Sending newsletter...')
    await newsletter.sendNewsletter()
    
    console.log('Newsletter sent successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error sending newsletter:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = main