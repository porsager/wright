const url = require('url')
    , path = require('path')
    , config = require('../config')
    , WebSocket = require('ws')

module.exports = function(debuggerUrl) {
  return new Promise((resolve, reject) => {

    const ws = new WebSocket(debuggerUrl)
        , wss = new WebSocket.Server({ port: config.debugProxyPort })
        , callbacks = new Map()
        , sockets = new Set()

    let id = 1000000

    wss.on('connection', socket => {
      sockets.add(socket)
      socket.on('message', data => {
        try {
          ws.send(data)
        } catch (e) { /**/ }
      })
      socket.on('close', () => sockets.delete(socket))
    })

    ws.on('open', () => {
      send('Debugger.enable', (err, result) => {
        if (err)
          return reject(err)

        resolve(send)
      })
    })

    ws.on('message', data => {
      const json = JSON.parse(data)

      if (json.method === 'Debugger.scriptParsed') {
        json.params.path = json.params.url && path.join(config.cwd, url.parse(json.params.url).path.substr(1))
        config.scripts(json.params)
      }

      if (json.id && callbacks.has(json.id)) {
        callbacks.get(json.id)(json.error, json.result)
        callbacks.delete(json.id)
      } else {
        sockets.forEach(s => s.send(data))
      }
    })

    function send(method, params, callback) {
      if (typeof params === 'function') {
        callback = params
        params = null
      }

      if (ws.readyState !== WebSocket.OPEN)
        return callback && callback({ message: 'Not connected' })

      const message = {
        id: id++,
        method: method
      }

      if (params)
        message.params = params

      ws.send(JSON.stringify(message))
      if (callback)
        callbacks.set(message.id, callback)
    }
  })
}
