const html = require('nanohtml')

module.exports = function settings (params) {
  const form = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Discord Newsletter Settings</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Configure guilds, channels, and email preferences</h2>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <form class="measure center">
          
          <!-- Discord Configuration -->
          <fieldset class="ba b--transparent ph0 mh0">
            <legend class="f5 fw6 ph0 mh0 white-80">Discord Configuration</legend>
            
            <div class="mt3">
              <label class="db fw6 lh-copy f6 white-80" for="guild-id">Guild ID</label>
              <input class="pa2 input-reset ba bg-transparent hover-bg-black w-100 white-80" 
                     type="text" name="guild-id" id="guild-id" 
                     placeholder="Enter Discord Guild ID">
            </div>
            
            <div class="mt3">
              <label class="db fw6 lh-copy f6 white-80" for="channel-id">Channel ID</label>
              <input class="pa2 input-reset ba bg-transparent hover-bg-black w-100 white-80" 
                     type="text" name="channel-id" id="channel-id" 
                     placeholder="Enter Discord Channel ID">
            </div>
          </fieldset>
          
          <!-- Email Configuration -->
          <fieldset class="ba b--transparent ph0 mh0 mt4">
            <legend class="f5 fw6 ph0 mh0 white-80">Email Configuration</legend>
            
            <div class="mt3">
              <label class="db fw6 lh-copy f6 white-80" for="email-to">Send To Email</label>
              <input class="pa2 input-reset ba bg-transparent hover-bg-black w-100 white-80" 
                     type="email" name="email-to" id="email-to" 
                     placeholder="recipient@example.com">
            </div>
            
            <div class="mt3">
              <label class="db fw6 lh-copy f6 white-80" for="email-from">From Email</label>
              <input class="pa2 input-reset ba bg-transparent hover-bg-black w-100 white-80" 
                     type="email" name="email-from" id="email-from" 
                     placeholder="sender@example.com">
            </div>
          </fieldset>
          
          <!-- Actions -->
          <div class="mt4">
            <input class="b ph3 pv2 input-reset ba b--white bg-transparent white-80 grow pointer f6 dib mr3" 
                   type="submit" value="Save Configuration">
            <a class="f6 link dim br1 ph3 pv2 mb2 dib white-60" href="#/">Cancel</a>
          </div>
          
        </form>
      </article>
    </div>
  `
  
  // Add form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const formData = new FormData(e.target)
    const settings = {
      guildId: formData.get('guild-id'),
      channelId: formData.get('channel-id'),
      emailTo: formData.get('email-to'),
      emailFrom: formData.get('email-from')
    }
    
    try {
      const response = await fetch('/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        alert('Settings saved successfully!')
        window.location.hash = '/'
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  })
  
  // Load existing settings
  fetch('/settings')
    .then(response => {
      if (response.ok) {
        return response.json()
      }
      return null
    })
    .then(settings => {
      if (settings) {
        form.querySelector('#guild-id').value = settings.guildId || ''
        form.querySelector('#channel-id').value = settings.channelId || ''
        form.querySelector('#email-to').value = settings.emailTo || ''
        form.querySelector('#email-from').value = settings.emailFrom || ''
      }
    })
    .catch(() => {
      // Ignore errors - means no settings exist yet
    })
  
  return form
}