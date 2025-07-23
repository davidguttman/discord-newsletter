const html = require('nanohtml')

// Simple markdown to HTML converter for newspaper content
function renderMarkdownToHTML (markdown) {
  if (!markdown) return ''

  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="f5 fw6 white-90 mt4 mb2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="f4 fw6 white-90 mt4 mb3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="f3 fw6 white-90 mt4 mb3">$1</h1>')

    // Italics (channel names)
    .replace(/\*([^*]+)\*/g, '<em class="white-60">$1</em>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="white-80 hover-white underline" target="_blank" rel="noopener">$1</a>')

    // Bold quotes and usernames
    .replace(/"([^"]+),"\s*said\s+(\w+)/g, '<strong class="white-90">"$1,"</strong> said <strong class="blue">$2</strong>')

    // Horizontal rule
    .replace(/^---$/gm, '<hr class="mv4 b--white-20">')

    // Bullet points
    .replace(/^- (.+)$/gm, '<li>$1</li>')

    // Wrap consecutive list items in ul tags
    .replace(/(<li>.*<\/li>)/gs, function (match) {
      return '<ul class="mt2 mb3 pl3">' + match + '</ul>'
    })

    // Line breaks and paragraphs
    .replace(/\n\n/g, '</p><p class="mt3 mb0 lh-copy">')
    .replace(/\n/g, '<br>')

    // Wrap in paragraph tags (avoid wrapping ul/h tags)
    .replace(/^(?!<[uh]|<li)(.+)/gm, '<p class="mt3 mb0 lh-copy">$1</p>')

    // Clean up empty paragraphs
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*><br><\/p>/g, '')
}

module.exports = function channelDetail (params) {
  const { guildId, channelId } = params

  const page = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <div id="channel-info-loading">
          <h1 class="f2 f1-l fw2 white-80 mv3">Loading...</h1>
        </div>
        <div id="channel-info" class="dn">
          <h1 class="f2 f1-l fw2 white-80 mv3">
            <span id="guild-name">Guild</span>
          </h1>
          <h2 class="f4 fw4 white-60 mv2">
            # <span id="channel-name">Channel</span>
          </h2>
          <p class="f6 fw4 ttu tracked white-40 mv0">Latest messages and subscription</p>
        </div>
        <div class="mt3">
          <a href="#/guilds/${guildId}/channels" class="f6 link dim white-60">← Back to channels</a>
        </div>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <!-- Message Collection Toggle -->
        <div class="bg-dark-gray pa3 br2 mb4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="ma0 f5 fw6 white-80">Message Collection</h3>
              <p class="ma0 mt1 f6 white-60">Toggle to start/stop storing messages from this channel</p>
            </div>
            <button id="collection-toggle" class="bn br2 ph3 pv2 pointer f6 fw6 bg-green white">
              <span id="collection-toggle-text">Start Collecting</span>
            </button>
          </div>
        </div>
        
        <!-- Daily Summary Section -->
        <div class="mb4">
          <div class="flex items-center justify-between mb3">
            <h3 class="f4 fw6 white-80 ma0">Daily Summary</h3>
            <button id="generate-summary" class="f6 link dim br2 ph3 pv2 dib white bg-blue bn pointer">
              Generate Summary
            </button>
          </div>
          
          <div id="summary-loading" class="dn tc pa3">
            <div class="ball-scale-ripple-multiple">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <p id="loading-status" class="white-60 mt3">Generating summary...</p>
            <div id="debug-steps" class="mt3 tl white-70 f7 lh-copy dn">
              <!-- Debug steps will be populated here -->
            </div>
          </div>
          
          <div id="summary-content" class="dn bg-dark-gray pa3 br2">
            <!-- Summary will be populated here -->
          </div>
          
          <style>
            .newspaper-content h1 { border-bottom: 2px solid #357edd; padding-bottom: 8px; }
            .newspaper-content h2 { border-bottom: 1px solid #357edd; padding-bottom: 4px; }
            .newspaper-content h3 { color: #357edd; }
            .newspaper-content em { font-style: italic; font-size: 0.9em; }
            .newspaper-content a { transition: all 0.2s ease; }
            .newspaper-content a:hover { color: #357edd; }
            .newspaper-content strong { font-weight: 600; }
            .newspaper-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.2); }
            .newspaper-content ul { margin: 1rem 0; padding-left: 1.5rem; }
            .newspaper-content li { margin-bottom: 0.5rem; }
          </style>
          
          <div id="no-summary" class="tc pa4 bg-dark-gray br2 o-50">
            <p class="white-60 ma0">No daily summary available for the last 24 hours</p>
            <p class="white-40 ma0 mt2 f6">Click "Generate Summary" to create one</p>
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
            <p class="white-60 ma0 mb3">No stored messages found for this channel</p>
            <button id="load-preview" class="f6 link dim br2 ph3 pv2 dib white bg-blue bn pointer">
              Load Preview
            </button>
            <p class="white-40 ma0 mt3 f6">Start collecting to store messages automatically</p>
          </div>
          
          <div id="error" class="dn tc">
            <p class="white-60">Failed to load messages. Please try again.</p>
          </div>
        </div>
      </article>
    </div>
  `

  // Add event listener for collection toggle
  const toggleBtn = page.querySelector('#collection-toggle')
  toggleBtn.addEventListener('click', () => {
    window.toggleCollection(guildId, channelId)
  })

  // Add event listener for load preview button
  const previewBtn = page.querySelector('#load-preview')
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      loadPreviewMessages(guildId, channelId, page)
    })
  }

  // Add event listener for generate summary button
  const summaryBtn = page.querySelector('#generate-summary')
  summaryBtn.addEventListener('click', () => {
    generateSummary(guildId, channelId, page)
  })

  // Load guild and channel info
  loadChannelInfo(guildId, channelId, page)

  // Check current collection status
  checkCollectionStatus(guildId, channelId, page)

  // Load daily summary
  loadDailySummary(guildId, channelId, page)

  // Load recent messages
  loadMessages(guildId, channelId, page)

  return page
}

function loadChannelInfo (guildId, channelId, page) {
  // Load guild and channel names
  Promise.all([
    fetch('/guilds').then(r => r.ok ? r.json() : []),
    fetch(`/guilds/${guildId}/channels`).then(r => r.ok ? r.json() : [])
  ])
    .then(([guilds, channels]) => {
      const guild = guilds.find(g => g.id === guildId)
      const channel = channels.find(c => c.id === channelId)

      const loading = page.querySelector('#channel-info-loading')
      const info = page.querySelector('#channel-info')
      const guildNameEl = page.querySelector('#guild-name')
      const channelNameEl = page.querySelector('#channel-name')

      loading.classList.add('dn')
      info.classList.remove('dn')

      if (guild) {
        guildNameEl.textContent = guild.name
      }

      if (channel) {
        channelNameEl.textContent = channel.name
      }
    })
    .catch(err => {
      console.error('Failed to load channel info:', err)
      const loading = page.querySelector('#channel-info-loading')
      const info = page.querySelector('#channel-info')

      loading.classList.add('dn')
      info.classList.remove('dn')

      // Show fallback text
      const guildNameEl = page.querySelector('#guild-name')
      const channelNameEl = page.querySelector('#channel-name')
      guildNameEl.textContent = 'Unknown Guild'
      channelNameEl.textContent = 'Unknown Channel'
    })
}

function checkCollectionStatus (guildId, channelId, page) {
  fetch(`/settings/${guildId}/${channelId}`)
    .then(response => {
      const toggleBtn = page.querySelector('#collection-toggle')
      const toggleText = page.querySelector('#collection-toggle-text')

      if (response.ok) {
        // Channel is being collected
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-red white'
        toggleText.textContent = 'Stop Collecting'
      } else {
        // Channel is not being collected
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-green white'
        toggleText.textContent = 'Start Collecting'
      }
    })
    .catch(() => {
      // Default to not collecting on error
      const toggleBtn = page.querySelector('#collection-toggle')
      const toggleText = page.querySelector('#collection-toggle-text')
      toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-green white'
      toggleText.textContent = 'Start Collecting'
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
                ${message.attachments && message.attachments.length > 0
? `
                  <div class="mt2">
                    <span class="f7 white-40">${message.attachments.length} attachment(s)</span>
                  </div>
                `
: ''}
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

function loadPreviewMessages (guildId, channelId, page) {
  const previewBtn = page.querySelector('#load-preview')
  const noMessages = page.querySelector('#no-messages')
  const messagesList = page.querySelector('#messages-list')

  if (!previewBtn) {
    return
  }

  // Show loading state
  previewBtn.textContent = 'Loading...'
  previewBtn.disabled = true

  fetch(`/preview/${guildId}/${channelId}?limit=10`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(data => {
      // Hide no-messages section and show messages list
      noMessages.classList.add('dn')
      messagesList.classList.remove('dn')

      // Add preview header
      const previewHeader = `
        <div class="bg-blue pa3 br2 mb3">
          <h4 class="ma0 f6 fw6 white">Preview Messages</h4>
          <p class="ma0 mt1 f7 white-80">Recent messages from ${data.channelName} (not stored)</p>
        </div>
      `

      // Render messages with preview styling
      const messagesHtml = data.messages.map(message => {
        const date = new Date(message.createdAt).toLocaleString()
        return `
          <div class="bb b--dark-gray pv3 o-70">
            <div class="flex items-start">
              <div class="flex-auto">
                <div class="flex items-center mb2">
                  <span class="f6 fw6 white-80 mr2">${message.authorUsername}</span>
                  <span class="f7 white-40">${date}</span>
                </div>
                <p class="ma0 f6 white-70 lh-copy">${message.content || '<em>No text content</em>'}</p>
                ${message.attachments && message.attachments.length > 0
? `
                  <div class="mt2">
                    <span class="f7 white-40">${message.attachments.length} attachment(s)</span>
                  </div>
                `
: ''}
              </div>
            </div>
          </div>
        `
      }).join('')

      messagesList.innerHTML = previewHeader + messagesHtml
    })
    .catch(err => {
      console.error('Failed to load preview messages:', err)

      // Reset button state
      previewBtn.textContent = 'Load Preview'
      previewBtn.disabled = false

      // Show error message
      if (err.message.includes('503')) {
        alert('Discord client not ready. Please try again in a moment.')
      } else if (err.message.includes('403')) {
        alert('Bot lacks permissions to read messages in this channel.')
      } else if (err.message.includes('404')) {
        alert('Channel not found.')
      } else {
        alert('Failed to load preview messages. Please try again.')
      }
    })
}

function loadDailySummary (guildId, channelId, page) {
  // Create API client instance
  const api = new ApiClient()

  api.checkSummary(guildId, channelId, '24h')
    .then(data => {
      const summaryContent = page.querySelector('#summary-content')
      const noSummary = page.querySelector('#no-summary')
      const generateBtn = page.querySelector('#generate-summary')

      if (data.summary) {
        // Show existing summary
        noSummary.classList.add('dn')
        summaryContent.classList.remove('dn')

        const createdDate = new Date(data.createdAt).toLocaleString()
        summaryContent.innerHTML = `
          <div class="mb3">
            <div class="flex items-center justify-between mb2">
              <h4 class="ma0 f6 fw6 white-80">Daily Summary (Last 24 Hours)</h4>
              <span class="f7 white-40">Generated ${createdDate}</span>
            </div>
            <p class="ma0 f7 white-60 mb3">${data.messageCount} messages processed</p>
          </div>
          <div class="white-70 lh-copy f6 newspaper-content">
            ${renderMarkdownToHTML(data.summary)}
          </div>
        `

        // Update button text to indicate recreation
        generateBtn.textContent = 'Regenerate Summary'
      } else {
        // No summary exists
        summaryContent.classList.add('dn')
        noSummary.classList.remove('dn')
        generateBtn.textContent = 'Generate Summary'
      }
    })
    .catch(err => {
      console.error('Failed to load daily summary:', err)
      // Show no summary state on error
      const summaryContent = page.querySelector('#summary-content')
      const noSummary = page.querySelector('#no-summary')
      const generateBtn = page.querySelector('#generate-summary')

      summaryContent.classList.add('dn')
      noSummary.classList.remove('dn')
      generateBtn.textContent = 'Generate Summary'
    })
}

function generateSummary (guildId, channelId, page) {
  const summaryLoading = page.querySelector('#summary-loading')
  const summaryContent = page.querySelector('#summary-content')
  const noSummary = page.querySelector('#no-summary')
  const generateBtn = page.querySelector('#generate-summary')
  const debugSteps = page.querySelector('#debug-steps')

  // Show loading state
  summaryLoading.classList.remove('dn')
  summaryContent.classList.add('dn')
  noSummary.classList.add('dn')
  debugSteps.classList.remove('dn')
  generateBtn.disabled = true
  generateBtn.textContent = 'Generating...'

  // Clear and show debug steps
  debugSteps.innerHTML = '<h4 class="ma0 mb2 f6 fw6 white-80">Debug Steps:</h4>'

  // Create API client instance
  const api = new ApiClient()

  api.generateSummary(guildId, channelId, '24h', { debug: true })
    .then(data => {
      // Hide loading state
      summaryLoading.classList.add('dn')
      generateBtn.disabled = false

      // Display debug steps if available
      if (data.debugSteps && data.debugSteps.length > 0) {
        const debugHtml = data.debugSteps.map(step => {
          const time = new Date(step.timestamp).toLocaleTimeString()
          return `<div class="mb2 pb2 bb b--white-10">
            <span class="f7 white-40">[${time}]</span>
            <span class="f7 white-70 ml2">${step.message}</span>
          </div>`
        }).join('')
        debugSteps.innerHTML = `
          <h4 class="ma0 mb2 f6 fw6 white-80">Debug Steps:</h4>
          ${debugHtml}
        `
      }

      // Show metadata if available
      let metadataHtml = ''
      if (data.metadata) {
        if (data.metadata.approach === 'multi-pass-with-catchall') {
          metadataHtml = `
            <div class="mb3 bg-near-black pa2 br2">
              <h5 class="ma0 mb2 f7 fw6 white-60">Multi-Pass Processing with Catchall:</h5>
              <div class="f7 white-50">
                <div>Passes: ${data.metadata.passes}</div>
                <div>Topics Found: ${data.metadata.topicsFound}</div>
                <div>Stories Generated: ${data.metadata.storiesGenerated}</div>
                <div>Community Highlights: ${data.metadata.hasCatchall ? 'Yes' : 'No'}</div>
                <div class="mt1">Topics: ${data.metadata.topics.map(t => t.description).join(', ')}</div>
              </div>
            </div>
          `
        } else if (data.metadata.approach === 'multi-pass') {
          metadataHtml = `
            <div class="mb3 bg-near-black pa2 br2">
              <h5 class="ma0 mb2 f7 fw6 white-60">Multi-Pass Processing Results:</h5>
              <div class="f7 white-50">
                <div>Topics Found: ${data.metadata.topicsFound}</div>
                <div>Stories Generated: ${data.metadata.storiesGenerated}</div>
                <div class="mt1">Topics: ${data.metadata.topics.map(t => t.description).join(', ')}</div>
              </div>
            </div>
          `
        } else {
          metadataHtml = `
            <div class="mb3 bg-near-black pa2 br2">
              <h5 class="ma0 f7 fw6 white-60">Single-Pass Processing</h5>
            </div>
          `
        }
      }

      if (data.summary) {
        // Show new summary
        summaryContent.classList.remove('dn')

        const createdDate = new Date().toLocaleString()
        summaryContent.innerHTML = `
          <div class="mb3">
            <div class="flex items-center justify-between mb2">
              <h4 class="ma0 f6 fw6 white-80">Daily Summary (Last 24 Hours)</h4>
              <span class="f7 white-40">Generated ${createdDate}</span>
            </div>
            <p class="ma0 f7 white-60 mb3">${data.messageCount} messages processed | ${data.usage ? data.usage.total_tokens + ' tokens' : 'No usage data'}</p>
          </div>
          ${metadataHtml}
          <div class="white-70 lh-copy f6 newspaper-content">
            ${renderMarkdownToHTML(data.summary)}
          </div>
        `

        generateBtn.textContent = 'Regenerate Summary'
      } else {
        // Show error or no messages state
        noSummary.classList.remove('dn')
        const noSummaryText = page.querySelector('#no-summary p')
        noSummaryText.textContent = data.error || 'No messages found in the last 24 hours'
        generateBtn.textContent = 'Generate Summary'
      }
    })
    .catch(err => {
      console.error('Failed to generate summary:', err)

      // Hide loading state and debug steps, show error
      summaryLoading.classList.add('dn')
      debugSteps.classList.add('dn')
      generateBtn.disabled = false
      generateBtn.textContent = 'Generate Summary'

      noSummary.classList.remove('dn')
      const noSummaryText = page.querySelector('#no-summary p')
      noSummaryText.textContent = 'Failed to generate summary. Please try again.'
    })
}

// Global function for collection toggle
window.toggleCollection = async function (guildId, channelId) {
  console.log('toggleCollection called with:', guildId, channelId)
  try {
    // Check if channel is currently being collected
    const currentResponse = await fetch(`/settings/${guildId}/${channelId}`)
    const isCurrentlyCollecting = currentResponse.ok

    if (isCurrentlyCollecting) {
      // Stop collecting - remove channel from collection
      const response = await fetch(`/settings/${guildId}/${channelId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Update button
        const toggleBtn = document.querySelector('#collection-toggle')
        const toggleText = document.querySelector('#collection-toggle-text')
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-green white'
        toggleText.textContent = 'Start Collecting'
      } else {
        throw new Error('Failed to stop collecting')
      }
    } else {
      // Start collecting - add channel to collection
      const response = await fetch('/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId,
          channelId
        })
      })

      if (response.ok) {
        // Update button
        const toggleBtn = document.querySelector('#collection-toggle')
        const toggleText = document.querySelector('#collection-toggle-text')
        toggleBtn.className = 'bn br2 ph3 pv2 pointer f6 fw6 bg-red white'
        toggleText.textContent = 'Stop Collecting'
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    }
  } catch (err) {
    console.error('Collection toggle error:', err)
  }
}
