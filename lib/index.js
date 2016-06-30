const api = require('./api')
    , serve = require('./serve')
    , watch = require('./watch')
    , chrome = require('./chrome')
    , config = require('./config')

module.exports = function(options = {}) {

  config.set(options)

  return Promise.resolve()
  .then(serve)
  .then(chrome.start)
  .then(api)
  .then(watch)
  .then(() => config.api)

}
