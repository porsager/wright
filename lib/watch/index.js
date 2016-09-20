const log = require('../log')
    , path = require('path')
    , config = require('../config')
    , watch = require('./watch')
    , ui = require('../ui')
    , js = require('./js')
    , css = require('./css')
    , assets = require('./assets')
    , chrome = require('../chrome')

module.exports = function() {

  if (path.extname(config.main) === '.html')
    watch(config.main, () => ui.notification(config.main + ' changed', 'Refresh to see changes'))

  if (config.watch)
    watch(config.watch, refresh, true)

  return Promise.resolve()
  .then(js)
  .then(css)
  .then(assets)
}

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true })
}
