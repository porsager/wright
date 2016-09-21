'use strict'

const utils = require('../utils')
    , log = require('../log')
    , url = require('url')
    , config = require('../config')
    , sessions = require('../sessions')
    , WebSocket = require('ws')

module.exports = function() {
  let tabs

  return utils.request(config.debugUrl + '/json/list/').then(allTabs => {
    tabs = allTabs

    const tab =  tabs.find(t => {
      return url.parse(config.url).port === url.parse(t.url).port &&
             url.parse(config.url).hostname === url.parse(t.url).hostname
    })

    if (tab)
      return tab

    sessions.set('scripts', [])
    return utils.request(config.debugUrl + '/json/new?' + config.url)

  }).then(tab => {

    if (!tab.devtoolsFrontendUrl) {
      log('Can\'t connect while chrome dev tools is open - Exiting')
      return process.exit() // eslint-disable-line
    }

    const devTab = tabs.find(t => t.url.includes(':' + config.debugProxyPort + '/devtools/page'))

    if (devTab) {
      refresh(devTab)
    } else {
      const devUrl = tab.devtoolsFrontendUrl.replace(':' + config.debugPort, ':' + config.debugProxyPort)

      return utils.request(config.debugUrl + '/json/new?' + encodeURIComponent(config.debugUrl + devUrl))
      .then(() => utils.request(config.debugUrl + '/json/activate/' + tab.id))
      .then(() => ({ url: tab.webSocketDebuggerUrl, port: config.debugProxyPort }))
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
