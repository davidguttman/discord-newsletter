const { Client, GatewayIntentBits } = require('discord.js')
const config = require('../../config')
const email = require('../email')

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

// Configuration
const GUILD_ID = process.env.DISCORD_GUILD_ID
const CHANNEL_IDS = (process.env.DISCORD_CHANNEL_IDS || '').split(',')
const EMAIL_FROM = config.mailgunFrom
const EMAIL_TO = (process.env.NEWSLETTER_RECIPIENTS || '').split(',')

/**
 * Sends a weekly newsletter with messages from configured Discord channels
 */
async function sendNewsletter() {
  try {
    const guild = await client.guilds.fetch(GUILD_ID)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    let allMessages = []
    let channelNames = [] // New array to track channel names
    
    for (const channelId of CHANNEL_IDS) {
      try {
        const channel = await guild.channels.fetch(channelId)
        if (!channel || !channel.isTextBased()) continue
        
        channelNames.push(channel.name) // Save the channel name
        const messages = await fetchChannelMessages(channel, oneWeekAgo)
        allMessages = allMessages.concat(messages)
      } catch (error) {
        console.error(`Error fetching messages from channel ${channelId}:`, error)
      }
    }
    
    // Pass channelNames to sendEmail
    const html = generateEmailHTML(allMessages, oneWeekAgo)
    await sendEmail(html, oneWeekAgo, channelNames)
    
  } catch (error) {
    console.error('Error sending newsletter:', error)
  }
}

/**
 * Fetches messages from a Discord channel since a specified date
 * @param {Object} channel - Discord channel object
 * @param {Date} since - Date to fetch messages from
 * @returns {Array} Array of message objects
 */
async function fetchChannelMessages(channel, since) {
  const messages = []
  let lastMessageId = null
  
  while (true) {
    const options = { limit: 100 }
    if (lastMessageId) options.before = lastMessageId
    
    const fetchedMessages = await channel.messages.fetch(options)
    if (fetchedMessages.size === 0) break
    
    for (const message of fetchedMessages.values()) {
      if (message.createdAt < since) {
        return messages // Stop when we reach messages older than our timeframe
      }
      
      // Check if message meets criteria
      if (await shouldIncludeMessage(message)) {
        messages.push({
          content: message.content,
          author: message.author.username,
          timestamp: message.createdAt,
          channelId: message.channel.id,
          channelName: message.channel.name, // Add channel name
          url: message.url,
          reactions: message.reactions.cache.map(r => ({
            emoji: r.emoji.toString(),
            count: r.count
          }))
        })
      }
    }
    
    lastMessageId = fetchedMessages.last().id
  }
  
  return messages
}

/**
 * Determines if a message should be included in the newsletter
 * @param {Object} message - Discord message object
 * @returns {Boolean} Whether to include the message
 */
async function shouldIncludeMessage(message) {
  // Skip bot messages
  if (message.author.bot) return false
  
  // Skip messages with no content
  if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return false
  
  // Include messages with reactions or attachments
  if (message.reactions.cache.size > 0 || message.attachments.size > 0) return true
  
  // Include messages with substantial content
  if (message.content.length > 20) return true
  
  return false
}

/**
 * Generates HTML for the newsletter email
 * @param {Array} messages - Array of message objects
 * @param {Date} since - Start date for the newsletter
 * @returns {String} HTML content for the email
 */
function generateEmailHTML(messages, since) {
  // Group messages by channelId, but also store the channel name
  const groupedMessages = messages.reduce((acc, msg) => {
    if (!acc[msg.channelId]) {
      acc[msg.channelId] = {
        name: msg.channelName,
        messages: []
      }
    }
    acc[msg.channelId].messages.push(msg)
    return acc
  }, {})
  
  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .channel { margin-bottom: 30px; }
          .channel-header { background: #7289da; color: white; padding: 10px; border-radius: 5px; }
          .message { margin: 15px 0; padding: 15px; background: #f4f4f4; border-radius: 5px; }
          .author { font-weight: bold; color: #7289da; }
          .timestamp { color: #666; font-size: 0.9em; }
          .reactions { margin-top: 10px; }
          .reaction { display: inline-block; margin-right: 10px; padding: 2px 8px; background: #fff; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Discord Newsletter</h1>
        <p>Messages from ${since.toLocaleDateString()} to ${new Date().toLocaleDateString()}</p>
  `
  
  for (const [channelId, channelData] of Object.entries(groupedMessages)) {
    html += `
      <div class="channel">
        <h2 class="channel-header">Channel: #${channelData.name}</h2>
    `
    
    for (const msg of channelData.messages.sort((a, b) => a.timestamp - b.timestamp)) {
      html += `
        <div class="message">
          <div>
            <span class="author">${msg.author}</span>
            <span class="timestamp">${msg.timestamp.toLocaleString()}</span>
          </div>
          <p>${msg.content}</p>
          ${msg.reactions.length > 0 ? `
            <div class="reactions">
              ${msg.reactions.map(r => `<span class="reaction">${r.emoji} ${r.count}</span>`).join('')}
            </div>
          ` : ''}
          <a href="${msg.url}">View in Discord</a>
        </div>
      `
    }
    
    html += '</div>'
  }
  
  html += `
      </body>
    </html>
  `
  
  return html
}

/**
 * Sends the newsletter email
 * @param {String} html - HTML content for the email
 * @param {Date} since - Start date for the newsletter
 * @param {Array} channelNames - Array of channel names
 */
async function sendEmail(html, since, channelNames) {
  const dateRange = `${since.toLocaleDateString()} to ${new Date().toLocaleDateString()}`
  
  // Format channel names for the subject
  const channelNamesStr = channelNames.length > 0 
    ? channelNames.map(name => `#${name}`).join(', ') 
    : 'Discord'
  
  const options = {
    to: EMAIL_TO.join(','),
    subject: `${channelNamesStr} ${dateRange} Discord Newsletter`,
    html: html
  }
  
  try {
    const response = await email.sendEmail(options)
    console.log('Newsletter sent successfully:', response)
    return response
  } catch (error) {
    console.error('Error sending newsletter:', error)
    throw error
  }
}

/**
 * Initializes the Discord client and logs in
 */
async function init() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN environment variable is required')
  }
  
  if (!GUILD_ID) {
    throw new Error('DISCORD_GUILD_ID environment variable is required')
  }
  
  if (!CHANNEL_IDS || CHANNEL_IDS.length === 0 || CHANNEL_IDS[0] === '') {
    throw new Error('DISCORD_CHANNEL_IDS environment variable is required')
  }
  
  if (!EMAIL_TO || EMAIL_TO.length === 0 || EMAIL_TO[0] === '') {
    throw new Error('NEWSLETTER_RECIPIENTS environment variable is required')
  }
  
  await client.login(process.env.DISCORD_TOKEN)
  console.log(`Logged in as ${client.user.tag}`)
}

module.exports = {
  init,
  sendNewsletter
}