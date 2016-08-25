const path = require('path')
    , fs = require('fs')
    , os = require('os')

const file = path.join(os.tmpdir(), 'wright.sessions.json')

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
    fs.readFile(file, 'utf8', (_, data) => {
      try {
        resolve(JSON.parse(data))
      } catch (e) {
        resolve({})
      }
    })
  })
}

function saveSessions(data) {
  fs.writeFile(file, JSON.stringify(data), 'utf8')
}
