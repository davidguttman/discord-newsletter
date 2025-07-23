const html = require('nanohtml')

module.exports = function settings (params) {
  const form = html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Email Settings</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Configure email preferences for summaries</h2>
        <div class="mt3">
          <a href="#/guilds" class="f6 link dim white-60">← Browse guilds to select channels</a>
        </div>
      </header>
      
      <article class="pa3 pa5-ns mw7 center">
        <form class="measure center">
          
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
    const emailTo = formData.get('email-to')
    const emailFrom = formData.get('email-from')

    if (!emailTo || !emailFrom) {
      alert('Please fill in both email addresses')
      return
    }

    try {
      // Get current settings to update email fields only
      const currentResponse = await fetch('/settings')
      const currentSettings = currentResponse.ok ? await currentResponse.json() : null

      if (!currentSettings) {
        alert('No channel is currently being collected. Please select a channel first by browsing guilds.')
        return
      }

      const response = await fetch(`/settings/${currentSettings._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          guildId: currentSettings.guildId,
          channelId: currentSettings.channelId,
          emailTo,
          emailFrom
        })
      })

      if (response.ok) {
        alert('Email settings saved successfully!')
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
        form.querySelector('#email-to').value = settings.emailTo === 'placeholder@example.com' ? '' : (settings.emailTo || '')
        form.querySelector('#email-from').value = settings.emailFrom === 'placeholder@example.com' ? '' : (settings.emailFrom || '')
      }
    })
    .catch(() => {
      // Ignore errors - means no settings exist yet
    })

  return form
}
