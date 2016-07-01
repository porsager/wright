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
          reject(err)
        else
          resolve(send)
      })
    })

    ws.on('message', data => {
      sockets.forEach(s => s.send(data))
      data = JSON.parse(data)

      if (data.method === 'Debugger.scriptParsed') {
        if (data.params.url)
          data.params.path = path.join(config.cwd, url.parse(data.params.url).path.substr(1))

        config.scripts(data.params)
      } else if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.error, data.result)
        callbacks.delete(data.id)
      }
    })

    function send(method, params, callback) {
      if (!callback) {
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
