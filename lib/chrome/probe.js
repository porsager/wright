const config = require('../config')
    , session = require('../session')
    , utils = require('../utils')

module.exports = function() {

  return utils.request(config.debugUrl + '/json/list/')
  .then(tabs => {
    if (!Array.isArray(tabs))
      throw new Error('Not a chrome response')

    const tab = tabs.find(t => config.url && t.url.startsWith(config.url.slice(0, -1)))

    if (!tab)
      return utils.nextFreePort(config.debugPort + 1).then(port => config.debugProxyPort = port)
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
      return utils.nextFreePort(config.debugPort + 1).then(port => config.debugProxyPort = port)
    })
  })
  .then(() => {
    session.set('debugPort', config.debugPort)
    session.set('debugProxyPort', config.debugProxyPort)
  })
}
