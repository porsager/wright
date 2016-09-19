'use strict'

const config = require('./config')
    , serve = require('./serve')
    , chrome = require('./chrome')
    , watch = require('./watch')
    , inject = require('./inject')
    , jail = require('./jail')
    , log = require('./log')

let promise

module.exports = function wright(options) {
  if (promise)
    return promise

  promise = Promise.resolve()
  .then(config.set(options))
  .then(serve)
  .then(chrome.start)
  .then(watch)
  .then(inject)
  .catch(log)

  return promise
}

module.exports.jail = jail
module.exports.chrome = chrome
