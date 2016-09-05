const fs = require('fs')
    , path = require('path')
    , config = require('./config')

const filename = 'wright.session.json'

module.exports.get = function(key) {
  return getSessions().then(sessions => sessions[key])
}

module.exports.set = function(key, value) {
  return getSessions().then(sessions => {
    sessions[key] = value
    saveSessions(sessions)
  })
}

function getSessions() {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(config.appData, filename), 'utf8', (_, data) => {
      try {
        resolve(JSON.parse(data))
      } catch (e) {
        resolve({})
      }
    })
  })
}

function saveSessions(data) {
  fs.writeFile(path.join(config.appData, filename), JSON.stringify(data), 'utf8')
}
