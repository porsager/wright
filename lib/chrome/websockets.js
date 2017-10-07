'use strict'

const WebSocket = require('ws')
    , PersistentWebSocket = require('pws')
    , log = require('../log')
    , EventEmitter = require('events')

const chrome = new EventEmitter()
    , promises = new Map()
    , startId = 10000000

module.exports = chrome

let id = startId

chrome.send = function(method, params) {
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

chrome.connect = function(tab) {
  return new Promise((resolve, reject) => {

    const wss = new WebSocket.Server({ port: tab.port })
        , sockets = new Set()
        , ws = new PersistentWebSocket(tab.url, {
          pingTimeout: 0,
          maxReconnectDelay: 1000 * 10
        }, WebSocket)

    chrome.ws = ws
    wss.on('connection', debuggerAttached)

    ws.onopen = () => {
      resolve(chrome)
      chrome.send('Page.disable')
      .then(() => chrome.send('Debugger.disable'))
      .then(() => chrome.send('Page.enable'))
      .then(() => chrome.send('Debugger.enable'))
      .then(() => chrome.send('Network.setCacheDisabled', { cacheDisabled: true } ))
      .then(() => chrome.emit('Started'))
      .catch(log.error)
    }

    ws.onerror = err => {
      log.debug(String(err))
      reject()
    }

    ws.onclose = () => {
      log.error('Connection to Chrome debugger closed - reconnecting')
    }

    ws.onmessage = message => {
      const data = JSON.parse(message.data)

      if (!data.id || (data.id >= 0 && data.id < startId))
        sockets.forEach(s => s.send(message.data))

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

    function debuggerAttached(socket) {
      sockets.add(socket)
      socket.on('message', data => {
        try {
          ws.send(data)
        } catch (e) { /**/ }
      })
      socket.on('close', () => sockets.delete(socket))
    }
  })
}
