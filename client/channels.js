const html = require('nanohtml')

module.exports = function channels (params) {
  const guildId = params.guildId
  
  const page = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Discord Channels</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Select a channel to view messages</h2>
        <div class="mt3">
          <a href="#/guilds" class="f6 link dim white-60">← Back to guilds</a>
        </div>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <div id="loading" class="tc">
          <div class="ball-scale-ripple-multiple">
            <div></div>
            <div></div>
            <div></div>
          </div>
          <p class="white-60 mt3">Loading channels...</p>
        </div>
        
        <div id="channels-list" class="dn">
          <!-- Channels will be populated here -->
        </div>
        
        <div id="error" class="dn tc">
          <p class="white-60">Failed to load channels. Please try again.</p>
        </div>
      </article>
    </div>
  `
  
  // Load channels from API and get current settings
  Promise.all([
    fetch(`/guilds/${guildId}/channels`).then(r => r.ok ? r.json() : []),
    fetch('/settings').then(r => r.ok ? r.json() : null)
  ])
    .then(([channels, settings]) => {
      const loading = page.querySelector('#loading')
      const channelsList = page.querySelector('#channels-list')
      
      loading.classList.add('dn')
      channelsList.classList.remove('dn')
      
      if (channels.length === 0) {
        channelsList.innerHTML = '<p class="tc white-60">No channels found</p>'
        return
      }
      
      // Sort channels - active one first, then by position
      const activeChannelId = settings?.guildId === guildId ? settings?.channelId : null
      const sortedChannels = channels.sort((a, b) => {
        if (a.id === activeChannelId && b.id !== activeChannelId) return -1
        if (b.id === activeChannelId && a.id !== activeChannelId) return 1
        return a.position - b.position
      })
      
      channelsList.innerHTML = sortedChannels.map(channel => {
        const isActive = channel.id === activeChannelId
        const activeIndicator = isActive ? '<span class="f7 bg-green white ph2 pv1 br2 ml2">COLLECTING</span>' : ''
        
        return `
          <div class="bb b--dark-gray ${isActive ? 'bg-dark-green' : ''}">
            <a href="#/guilds/${guildId}/channels/${channel.id}" class="link white-80 hover-white dim flex items-center pa3">
              <div class="flex-auto">
                <h3 class="ma0 f5 fw6"># ${channel.name} ${activeIndicator}</h3>
                <p class="ma0 mt1 f6 white-60">Type: ${channel.type}</p>
              </div>
              <div class="white-40 f6">→</div>
            </a>
          </div>
        `
      }).join('')
    })
    .catch(err => {
      console.error('Failed to load channels:', err)
      const loading = page.querySelector('#loading')
      const error = page.querySelector('#error')
      
      loading.classList.add('dn')
      error.classList.remove('dn')
      
      // Show better error message
      if (err.message.includes('404')) {
        error.innerHTML = '<p class="white-60">Guild not found or bot not in this guild.</p>'
      } else if (err.message.includes('503')) {
        error.innerHTML = '<p class="white-60">Discord client not ready. Please try again in a moment.</p>'
      }
    })
  
  return page
}