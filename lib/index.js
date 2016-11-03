'use strict'

const config = require('./config')
    , execute = require('./execute')
    , serve = require('./serve')
    , chrome = require('./chrome')
    , watch = require('./watch')
    , jail = require('./jail')
    , log = require('./log')
    , ui = require('./ui')

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
  .catch(err => {
    log.error(err)
    process.exit() // eslint-disable-line
  })

  return promise
}

module.exports.jail = jail
module.exports.chrome = chrome
