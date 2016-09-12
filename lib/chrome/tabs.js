'use strict'

const utils = require('../utils')
    , log = require('../log')
    , url = require('url')
    , config = require('../config')
    , WebSocket = require('ws')

module.exports = function() {
  let tabs

  return utils.request(config.chromeUrl + '/json/list/').then(allTabs => {
    tabs = allTabs

    return tabs.find(t => {
      return url.parse(config.url).port === url.parse(t.url).port &&
             url.parse(config.url).hostname === url.parse(t.url).hostname
    }) || utils.request(config.chromeUrl + '/json/new?' + config.url)

  }).then(tab => {

    if (!tab.devtoolsFrontendUrl) {
      log('Can\'t connect while chrome dev tools is open - Exiting')
      return process.exit()
    }

    const devTab = tabs.find(t => t.url.includes(':' + config.debugProxyPort + '/devtools/page'))

    if (devTab) {
      refresh(devTab)
    } else {
      const devUrl = tab.devtoolsFrontendUrl.replace(':' + config.debugPort, ':' + config.debugProxyPort)

      utils.request(config.chromeUrl + '/json/new?' + encodeURIComponent(config.chromeUrl + devUrl)).then(() => {
        utils.request(config.chromeUrl + '/json/activate/' + tab.id)
      })
    }

    return { url: tab.webSocketDebuggerUrl, port: config.debugProxyPort }
  })

}

function refresh(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl)

  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.reload' }))
    ws.close()
  }).on('error', () => {
    // Fail silently
  })
}
