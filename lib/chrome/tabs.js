'use strict'

const utils = require('../utils')
    , url = require('url')
    , config = require('../config')
    , session = require('../session')

module.exports = () =>

  utils.request(config.debugUrl + '/json/list/').then(tabs => {

    tabs.filter(t => t.url.startsWith('chrome://')).forEach(t =>
      utils.request(config.debugUrl + '/json/close/' + t.id)
    )

    closeNewTab()

    const tab = tabs.find(t =>
      url.parse(config.url).port === url.parse(t.url).port &&
      url.parse(config.url).hostname === url.parse(t.url).hostname
    )

    if (tab)
      return tab

    session.set('scripts', [])
    return utils.request(config.debugUrl + '/json/new?' + config.url)
  }).then(tab => {
    return { url: tab.webSocketDebuggerUrl }
  })

function closeNewTab() {
  const interval = setInterval(() => {
    utils.request(config.debugUrl + '/json/list/').then(tabs => {
      const newtab = tabs.find(t => t.url === 'chrome://newtab/')
      return newtab && utils.request(config.debugUrl + '/json/close/' + newtab.id)
    }).catch(() => {
      // noop
    })
  }, 50)

  setTimeout(() => clearInterval(interval), 5000)
}
