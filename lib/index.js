const config = require('./config')
    , serve = require('./serve')
    , chrome = require('./chrome')
    , watch = require('./watch')
    , inject = require('./inject')
    , jail = require('./jail')
    , log = require('./log')

let started = false

module.exports = function wright(options) {
  if (started)
    return

  started = true

  return Promise.resolve()
  .then(config.set(options))
  .then(serve)
  .then(chrome.start)
  .then(watch)
  .catch(log)

}

module.exports.jail = jail
module.exports.chrome = chrome.api
