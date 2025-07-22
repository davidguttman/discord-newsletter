const html = require('nanohtml')

module.exports = function guilds (params) {
  const page = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Discord Guilds</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Select a guild to view channels</h2>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <div id="loading" class="tc">
          <div class="ball-scale-ripple-multiple">
            <div></div>
            <div></div>
            <div></div>
          </div>
          <p class="white-60 mt3">Loading guilds...</p>
        </div>
        
        <div id="guilds-list" class="dn">
          <!-- Guilds will be populated here -->
        </div>
        
        <div id="error" class="dn tc">
          <p class="white-60">Failed to load guilds. Please try again.</p>
        </div>
      </article>
    </div>
  `
  
  // Load guilds from API
  fetch('/guilds')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(guilds => {
      const loading = page.querySelector('#loading')
      const guildsList = page.querySelector('#guilds-list')
      
      loading.classList.add('dn')
      guildsList.classList.remove('dn')
      
      if (guilds.length === 0) {
        guildsList.innerHTML = '<p class="tc white-60">No guilds found</p>'
        return
      }
      
      guildsList.innerHTML = guilds.map(guild => `
        <div class="bb b--dark-gray pv3">
          <a href="#/guilds/${guild.id}/channels" class="link white-80 hover-white dim flex items-center">
            <div class="flex-auto">
              <h3 class="ma0 f5 fw6">${guild.name}</h3>
              <p class="ma0 mt1 f6 white-60">${guild.memberCount} members</p>
            </div>
            <div class="white-40 f6">→</div>
          </a>
        </div>
      `).join('')
    })
    .catch(err => {
      console.error('Failed to load guilds:', err)
      const loading = page.querySelector('#loading')
      const error = page.querySelector('#error')
      
      loading.classList.add('dn')
      error.classList.remove('dn')
      
      // Check if it's a settings issue
      if (err.message.includes('503')) {
        error.innerHTML = `
          <p class="white-60 mb3">Discord client not ready. Please configure settings first.</p>
          <a href="#/settings" class="f6 link dim br2 ph3 pv2 dib white bg-dark-blue">
            Configure Settings
          </a>
        `
      }
    })
  
  return page
}