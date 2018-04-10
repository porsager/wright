const log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , js = require('./js')
    , css = require('./css')
    , assets = require('./assets')
    , chrome = require('../chrome')

module.exports = function() {

  if (config.watch)
    watch(config.watch, refresh, true)

  if (!config.external && config.main.endsWith('.html'))
    watch(config.main, refresh)

  return Promise.resolve()
  .then(js)
  .then(css)
  .then(assets)
}

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true })
}
