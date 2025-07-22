require('./style')
const hash = require('http-hash')()

const welcome = require('./welcome')
const guilds = require('./guilds')
const channels = require('./channels')
const channelDetail = require('./channel-detail')

document.title = 'Discord Newsletter'

hash.set('/', welcome)
hash.set('/welcome/:name', welcome)
hash.set('/guilds', guilds)
hash.set('/guilds/:guildId/channels', channels)
hash.set('/guilds/:guildId/channels/:channelId', channelDetail)

window.addEventListener('hashchange', function () {
  window.location.reload()
})

const route = hash.get(window.location.hash.slice(1))
const el = route.handler({ ...route.params, splat: route.splat })

document.body.appendChild(el)