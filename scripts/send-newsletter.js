#!/usr/bin/env node
const { Client } = require('discord.js-selfbot-v13')
const mailgun = require('mailgun-js')
const config = require('../config')

// Configuration constants
const GUILD_ID = process.env.GUILD_ID || config.guildId
const CHANNEL_IDS = (process.env.CHANNEL_IDS || config.channelIds || '').split(',')
const EMAIL_FROM = process.env.EMAIL_FROM || config.mailgunFrom
const EMAIL_TO = (process.env.EMAIL_TO || config.emailRecipients || '').split(',')

// Initialize Discord client
const client = new Client({
  checkUpdate: false
})

// Initialize Mailgun client
const mg = process.env.NODE_ENV === 'test'
  ? null
  : mailgun({
    apiKey: config.mailgunApiKey,
    domain: config.mailgunDomain
  })

/**
 * Main function to send the newsletter
 */
async function sendNewsletter () {
  try {
    const guild = await client.guilds.fetch(GUILD_ID)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    let allMessages = []
    const channelNames = [] // New array to track channel names

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
  } finally {
    client.destroy()
  }
}

/**
 * Fetches messages from a channel since a specific date
 * @param {Object} channel Discord channel object
 * @param {Date} since Date to fetch messages since
 * @returns {Array} Array of processed messages
 */
async function fetchChannelMessages (channel, since) {
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
 * @param {Object} message Discord message object
 * @returns {Boolean} Whether to include the message
 */
async function shouldIncludeMessage (message) {
  // Skip empty messages, bot messages, or messages with no content
  if (!message.content || message.author.bot) {
    return false
  }

  // Include messages with reactions or mentions
  const hasReactions = message.reactions.cache.size > 0
  const hasMentions = message.mentions.users.size > 0 || message.mentions.roles.size > 0

  // Default criteria: include if it has reactions, mentions, or is substantive
  return hasReactions || hasMentions || message.content.length > 20
}

/**
 * Generates HTML for the email newsletter
 * @param {Array} messages Array of processed messages
 * @param {Date} since Date of oldest message
 * @returns {String} HTML content for email
 */
function generateEmailHTML (messages, since) {
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

  // Loop through grouped messages and create HTML for each channel
  Object.values(groupedMessages).forEach(channelData => {
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
          ${msg.reactions.length > 0
            ? `
            <div class="reactions">
              ${msg.reactions.map(r => `<span class="reaction">${r.emoji} ${r.count}</span>`).join('')}
            </div>
          `
            : ''}
          <a href="${msg.url}">View in Discord</a>
        </div>
      `
    }

    html += '</div>'
  })

  html += `
      </body>
    </html>
  `

  return html
}

/**
 * Send email with newsletter content
 * @param {String} html HTML content for the email
 * @param {Date} since Date of oldest message
 * @param {Array} channelNames Array of channel names
 */
async function sendEmail (html, since, channelNames) {
  const dateRange = `${since.toLocaleDateString()} to ${new Date().toLocaleDateString()}`

  // Format channel names for the subject
  const channelNamesStr = channelNames.length > 0
    ? channelNames.map(name => `#${name}`).join(', ')
    : 'Discord'

  const data = {
    from: EMAIL_FROM,
    to: EMAIL_TO.join(','),
    subject: `${channelNamesStr} ${dateRange} Discord Newsletter`,
    html
  }

  // Skip actual sending in test environment
  if (process.env.NODE_ENV === 'test') {
    console.log('[TEST] Email would be sent with data:', data)
    return { id: 'test-email-id' }
  }

  try {
    const response = await mg.messages().send(data)
    console.log('Email sent successfully:', response)
    return response
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

// Run the script if called directly
if (require.main === module) {
  // Login to Discord and send newsletter
  client.login(process.env.DISCORD_TOKEN || config.discordToken)
    .then(() => sendNewsletter())
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
}

module.exports = {
  sendNewsletter,
  fetchChannelMessages,
  generateEmailHTML,
  sendEmail
}
