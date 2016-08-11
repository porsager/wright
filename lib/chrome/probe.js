const config = require('../config')
    , utils = require('../utils')

module.exports = function() {

  config.debugPort = config.port + 1
  config.chromeUrl = 'http://localhost:' + config.debugPort

  return utils.request(config.chromeUrl + '/json/list/')
  .catch(() => {
    // If a connection could not be made we have no tabs
  })
  .then(tabs => tabs && tabs.find(t => config.url && t.url.startsWith(config.url.slice(0, -1))))
  .then(tab => !tab && utils.nextFreePort(config.debugPort))
  .then(port => {
    if (port) {
      config.debugPort = port
      config.chromeUrl = 'http://localhost:' + config.debugPort
    }
    return utils.nextFreePort(config.debugPort + 1)
  })
  .then(port => config.debugProxyPort = port)

}
