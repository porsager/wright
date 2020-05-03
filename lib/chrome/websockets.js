'use strict'

const WebSocket = require('ws')
    , PersistentWebSocket = require('pws')
    , log = require('../log')
    , EventEmitter = require('events')
    , config = require('../config')

const chrome = new EventEmitter()
    , promises = new Map()
    , startId = 1

module.exports = chrome

let id = startId
  , ws

chrome.send = function(method, params) {
  if (config.browser !== 'chrome')
    return

  return new Promise((resolve, reject) => {
    if (!chrome.ws || chrome.ws.readyState !== WebSocket.OPEN)
      return reject(new Error('Not connected to chrome debugger'))

    const message = {
      id: id++,
      method: method
    }

    if (params)
      message.params = params

    chrome.ws.send(JSON.stringify(message))
    promises.set(message.id, { resolve: resolve, reject: reject })
  })
}

const clientSrc = 'if(window.self === window.top) window.wright = {};'

chrome.connect = function(tab) {
  return new Promise((resolve, reject) => {
    if (ws)
      ws.close()

    ws = new PersistentWebSocket(tab.url, {
      pingTimeout: 0,
      maxTimeout: 1000 * 10
    }, WebSocket)

    chrome.ws = ws

    ws.onopen = () => {

      resolve(chrome)
      chrome.send('Page.disable')
      .then(() => chrome.send('Page.enable'))
      .then(() => chrome.send('Debugger.enable'))
      .then(() => chrome.send('DOM.enable'))
      .then(() => chrome.send('CSS.enable'))
      .then(() => chrome.send('Runtime.enable'))
      .then(() => chrome.send('Runtime.evaluate', { expression: clientSrc }))
      .then(() => chrome.send('Page.addScriptToEvaluateOnLoad', { scriptSource: clientSrc }))
      .then(() => chrome.send('Network.setCacheDisabled', { cacheDisabled: true } ))
      .then(() => chrome.emit('Started'))
      .catch(log.error)
    }

    ws.onerror = event => {
      log.debug('chrome ws', event.type, event.code || event.message)
      reject()
    }

    ws.onclose = (e) => {
      ws.retries < 3
        ? log.error('Connection to Chrome debugger closed - reconnecting')
        : process.exit()
    }

    ws.onmessage = message => {
      const data = JSON.parse(message.data)

      if (data.method)
        chrome.emit(data.method, data.params)

      const promise = promises.get(data.id)

      if (data.id && data.id >= startId && promise) {
        if (data.error)
          promise.reject(data.error)
        else
          promise.resolve(data.result)

        promises.delete(data.id)
      }
    }
  })
}
