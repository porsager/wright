const path = require('path')
    , fs = require('fs')
    , os = require('os')

const file = path.join(os.tmpdir(), 'wright.sessions.json')

const sessions = module.exports

sessions.get = function(key) {
  return getSessions().then(s => sessions[key])
}

sessions.set = function(key, value) {
  return getSessions().then(s => {
    s[key] = value
    saveSessions(s)
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
