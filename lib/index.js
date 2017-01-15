'use strict'

const ui = require('./ui')
    , log = require('./log')
    , jail = require('./jail')
    , serve = require('./serve')
    , clone = require('./clone')
    , watch = require('./watch')
    , config = require('./config')
    , chrome = require('./chrome')
    , execute = require('./execute')

let promise

module.exports = function wright(options) {
  log('Starting wright...')

  if (promise)
    return promise

  promise = Promise.resolve()
  .then(config.set(options))
  .then(execute)
  .then(serve)
  .then(watch)
  .then(chrome.start)
  .then(ui)
  .then(clone)
  .catch(err => {
    log.error(err)
    process.exit() // eslint-disable-line
  })

  return promise
}

module.exports.jail = jail
module.exports.chrome = chrome
module.exports.watch = require('./watch/watch')
