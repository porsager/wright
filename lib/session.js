const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')

const filename = 'wright.session.json'

let session

module.exports.get = function(key) {
  if (!session) {
    try {
      session = JSON.parse(fs.readFileSync(path.join(config.appData, filename), 'utf8'))
    } catch (err) {
      log.error('Reading session', err)
      session = {}
    }
  }

  return session[key]
}

module.exports.set = function(key, value) {
  session[key] = value
  saveSessions(session)
}

function saveSessions() {
  try {
    fs.writeFileSync(path.join(config.appData, filename), JSON.stringify(session), 'utf8')
  } catch (err) {
    log.error('Writing session', err)
  }
}
