const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')

const filename = 'wright.session.json'

let sessions = {}

try {
  sessions = JSON.parse(fs.readFileSync(path.join(config.appData, filename), 'utf8'))
} catch (err) {
  log.debug('Reading sessions', err)
}

module.exports.get = function(key) {
  return sessions[key]
}

module.exports.set = function(key, value) {
  sessions[key] = value
  saveSessions(sessions)
}

function saveSessions() {
  try {
    fs.writeFileSync(path.join(config.appData, filename), JSON.stringify(sessions), 'utf8')
  } catch (err) {
    log.error('Writing sessions', err)
  }
}
