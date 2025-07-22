const html = require('nanohtml')

module.exports = function welcome (params) {
  return html`
    <div class="sans-serif">
      <header class="tc pv4">
        <h1 class="f2 f1-l fw2 white-80 mv3">Discord Newsletter</h1>
        <h2 class="f6 fw4 ttu tracked white-40 mv0">Configuration Interface</h2>
      </header>
      <article class="pa3 pa5-ns">
        <h1 class="f4 bold center mw6">Welcome${params.name ? ` ${params.name}` : ''}!</h1>
        <p class="lh-copy measure center f6 white-80">
          Configure your Discord newsletter settings below. 
          Set up guilds, channels, and email preferences to get started.
        </p>
        <div class="tc mt4">
          <a href="#/guilds" class="f6 link dim br2 ph3 pv2 mb2 dib mr3 white bg-dark-blue">
            Browse Guilds & Channels
          </a>
          <a href="#/settings" class="f6 link dim br2 ph3 pv2 mb2 dib white bg-dark-green">
            Configure Settings
          </a>
        </div>
      </article>
    </div>
  `
}