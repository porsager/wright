const config = require('../config')
    , session = require('../session')
    , utils = require('../utils')

module.exports = function() {

  return utils.request(config.debugUrl + '/json/list/')
  .then(tabs => {
    if (!Array.isArray(tabs))
      throw new Error('Not a chrome response')
  })
  .catch(() => {
    session.set('scripts', [])
    session.set('assets', [])
    return utils.nextFreePort(config.debugPort)
    .then(port => {
      if (port) {
        config.debugPort = port
        config.debugUrl = 'http://localhost:' + config.debugPort
      }
    })
  })
  .then(() => session.set('debugPort', config.debugPort))
}
