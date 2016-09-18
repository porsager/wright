const config = require('../config')
    , sessions = require('../sessions')
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
    sessions.set('debugPort', config.debugPort)
    sessions.set('debugProxyPort', config.debugProxyPort)
  })
}
