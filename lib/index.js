const config = require('./config')
    , serve = require('./serve')
    , chrome = require('./chrome')
    , watch = require('./watch')
    , inject = require('./inject')
    , log = require('./log')

module.exports = function wright(options = {}) {

  config.set(options)

  return Promise.resolve()
  .then(serve)
  .then(chrome.start)
  .then(watch)
  .then(inject)
  .catch(log)

}
