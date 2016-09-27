'use strict'

const WebSocket = require('ws')
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
      return reject(new Error({ message: 'Not connected' }))

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
        , ws = new WebSocket(tab.url)

    chrome.ws = ws

    wss.on('connection', debuggerAttached)

    ws.on('open', () => {
      resolve(chrome)
      chrome.send('Page.disable')
      .then(() => chrome.send('Debugger.disable'))
      .then(() => chrome.send('Page.enable'))
      .then(() => chrome.send('Debugger.enable'))
      .then(() => chrome.emit('Started'))
      .catch(log.error)
    })

    ws.on('error', reject)

    ws.on('close', () => {
      log('Websocket to debugger closed - Exiting')
      process.exit() // eslint-disable-line
    })

    ws.on('message', message => {
      const data = JSON.parse(message)

      if (!data.id || (data.id >= 0 && data.id < startId))
        sockets.forEach(s => s.send(message))

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
    })

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
