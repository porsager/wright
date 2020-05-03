const log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , js = require('./js')
    , css = require('./css')
    , chrome = require('../chrome')

module.exports = function() {

  if (config.watch)
    watch(config.watch, refresh, true)

  if (!config.external)
    watch(config.main, refresh)

  return Promise.resolve()
  .then(js)
  .then(css)
}

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true })
}
