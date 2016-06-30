const utils = require('../utils')
    , config = require('../config')

module.exports = function() {
  let tabs

  return utils.request(config.chromeUrl + '/json/list/').then(allTabs => {
    tabs = allTabs

    const tab = tabs.find(t => config.url && t.url.startsWith(config.url.slice(0, -1)))

    if (tab)
      return tab

    return utils.request(config.chromeUrl + '/json/new?' + config.url)
  }).then(tab => {

    const devUrl = tab.devtoolsFrontendUrl.replace(':' + config.debugPort, ':' + config.debugProxyPort)

    const devTab = tabs.find(t => t.url.includes(':' + config.debugProxyPort + '/devtools/page'))

    if (devTab)
      utils.request(config.chromeUrl + '/json/close/' + devTab.id)

    utils.request(config.chromeUrl + '/json/new?' + encodeURIComponent(config.chromeUrl + devUrl)).then(() => {
      utils.request(config.chromeUrl + '/json/activate/' + tab.id)
    })

    return tab.webSocketDebuggerUrl
  })

}
