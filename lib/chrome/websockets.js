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

    const startId = 10000000
    let id = startId

    wss.on('connection', debuggerAttached)

    ws.on('open', () => {
      send('Page.enable', () =>
        send('Debugger.enable', (err) => (err ? reject(err) : resolve(send)))
      )
    })

    ws.on('message', message => {
      const data = JSON.parse(message)

      if (data.id < startId)
        sockets.forEach(s => s.send(message))

      if (data.method === 'Debugger.scriptParsed') {
        data.params.path = data.params.url && path.join(config.cwd, url.parse(data.params.url).path.substr(1))
        config.scripts(data.params)
      } else if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.error, data.result)
        callbacks.delete(data.id)
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
