'use strict'

const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , utils = require('./utils')
    , config = require('./config')

const sessionPath = path.join(utils.wrightDataDirectory, 'wright.session.json')

module.exports.get = function(key) {
  const sessions = read()

  return sessions[config.id] ? sessions[config.id][key] : undefined
}

module.exports.set = function(key, value) {
  save(key, value)
}

module.exports.portStart = function() {
  const sessions = read()
      , highestPort = Object.keys(sessions).map(key => sessions[key].port).sort().pop()

  return highestPort ? (highestPort + 3) : 3000
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8')) || {}
  } catch (err) {
    return {}
  }
}

module.exports.read = read

function save(key, value) {
  try {
    const session = read()

    if (!session[config.id])
      session[config.id] = {}

    session[config.id][key] = value
    fs.writeFileSync(sessionPath, JSON.stringify(session), 'utf8')
  } catch (err) {
    log.error('Error writing session', err)
  }
}
