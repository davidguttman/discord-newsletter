const html = require('nanohtml')

module.exports = function channelDetail (params) {
  const { guildId, channelId } = params
  
  const page = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Channel Details</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Latest messages and subscription</h2>
        <div class="mt3">
          <a href="#/guilds/${guildId}/channels" class="f6 link dim white-60">← Back to channels</a>
        </div>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <!-- Subscription Toggle -->
        <div class="bg-dark-gray pa3 br2 mb4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="ma0 f5 fw6 white-80">Message Subscription</h3>
              <p class="ma0 mt1 f6 white-60">Toggle to start/stop storing messages from this channel</p>
            </div>
            <button id="subscribe-toggle" class="bn br2 ph3 pv2 pointer f6 fw6 bg-green white" 
                    onclick="toggleSubscription('${guildId}', '${channelId}')">
              <span id="toggle-text">Subscribe</span>
            </button>
          </div>
        </div>
        
        <!-- Messages Section -->
        <div class="mb4">
          <h3 class="f4 fw6 white-80 mb3">Latest Messages</h3>
          
          <div id="loading" class="tc">
            <div class="ball-scale-ripple-multiple">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <p class="white-60 mt3">Loading messages...</p>
          </div>
          
          <div id="messages-list" class="dn">
            <!-- Messages will be populated here -->
          </div>
          
          <div id="no-messages" class="dn tc pa4 bg-dark-gray br2">
            <p class="white-60 ma0">No messages found for this channel</p>
            <p class="white-40 ma0 mt2 f6">Subscribe to start collecting messages</p>
          </div>
          
          <div id="error" class="dn tc">
            <p class="white-60">Failed to load messages. Please try again.</p>
          </div>
        </div>
      </article>
    </div>
  `
  
  // Check current subscription status
  checkSubscriptionStatus(guildId, channelId, page)
  
  // Load recent messages
  loadMessages(guildId, channelId, page)
  
  return page
}

function checkSubscriptionStatus (guildId, channelId, page) {
  fetch('/settings')
    .then(response => {
      if (response.ok) {
        return response.json()
      }
      return null
    })
    .then(settings => {
      const toggleBtn = page.querySelector('#subscribe-toggle')
      const toggleText = page.querySelector('#toggle-text')
      
      const isSubscribed = settings && settings.guildId === guildId && settings.channelId === channelId
      
      if (isSubscribed) {
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-red white'
        toggleText.textContent = 'Unsubscribe'
      } else {
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-green white'
        toggleText.textContent = 'Subscribe'
      }
    })
    .catch(() => {
      // Ignore errors
    })
}

function loadMessages (guildId, channelId, page) {
  fetch(`/messages?guildId=${guildId}&channelId=${channelId}&limit=20&sort=-createdAt`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(data => {
      const loading = page.querySelector('#loading')
      const messagesList = page.querySelector('#messages-list')
      const noMessages = page.querySelector('#no-messages')
      
      loading.classList.add('dn')
      
      if (!data.messages || data.messages.length === 0) {
        noMessages.classList.remove('dn')
        return
      }
      
      messagesList.classList.remove('dn')
      
      messagesList.innerHTML = data.messages.map(message => {
        const date = new Date(message.createdAt).toLocaleString()
        return `
          <div class="bb b--dark-gray pv3">
            <div class="flex items-start">
              <div class="flex-auto">
                <div class="flex items-center mb2">
                  <span class="f6 fw6 white-80 mr2">${message.authorUsername}</span>
                  <span class="f7 white-40">${date}</span>
                </div>
                <p class="ma0 f6 white-70 lh-copy">${message.content || '<em>No text content</em>'}</p>
                ${message.attachments && message.attachments.length > 0 ? `
                  <div class="mt2">
                    <span class="f7 white-40">${message.attachments.length} attachment(s)</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `
      }).join('')
    })
    .catch(err => {
      console.error('Failed to load messages:', err)
      const loading = page.querySelector('#loading')
      const error = page.querySelector('#error')
      
      loading.classList.add('dn')
      error.classList.remove('dn')
    })
}

// Global function for subscription toggle
window.toggleSubscription = async function (guildId, channelId) {
  try {
    // Get current settings
    const currentResponse = await fetch('/settings')
    const currentSettings = currentResponse.ok ? await currentResponse.json() : null
    
    const isCurrentlySubscribed = currentSettings && 
                                  currentSettings.guildId === guildId && 
                                  currentSettings.channelId === channelId
    
    if (isCurrentlySubscribed) {
      // Unsubscribe - delete current settings
      const response = await fetch(`/settings/${currentSettings._id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        alert('Unsubscribed successfully!')
        // Update button
        const toggleBtn = document.querySelector('#subscribe-toggle')
        const toggleText = document.querySelector('#toggle-text')
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-green white'
        toggleText.textContent = 'Subscribe'
      } else {
        throw new Error('Failed to unsubscribe')
      }
    } else {
      // Subscribe - create new settings (need email fields)
      const emailTo = prompt('Enter email to send summaries to:')
      const emailFrom = prompt('Enter from email address:')
      
      if (!emailTo || !emailFrom) {
        alert('Email addresses are required')
        return
      }
      
      const response = await fetch('/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId,
          channelId,
          emailTo,
          emailFrom
        })
      })
      
      if (response.ok) {
        alert('Subscribed successfully!')
        // Update button
        const toggleBtn = document.querySelector('#subscribe-toggle')
        const toggleText = document.querySelector('#toggle-text')
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-red white'
        toggleText.textContent = 'Unsubscribe'
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    }
  } catch (err) {
    alert(`Error: ${err.message}`)
  }
}