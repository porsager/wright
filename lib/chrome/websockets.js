const WebSocket = require('ws')
    , EventEmitter = require('events')

const chrome = new EventEmitter()

chrome.styles = new Map()

module.exports = function({ url, port }) {
  return new Promise((resolve, reject) => {

    const ws = new WebSocket(url)
        , wss = new WebSocket.Server({ port: port })
        , callbacks = new Map()
        , sockets = new Set()

    const startId = 10000000
    let id = startId

    wss.on('connection', debuggerAttached)

    ws.on('open', () => {
      resolve(chrome)
      chrome.send('Page.addScriptToEvaluateOnLoad', {
        scriptSource: contextMenuWarning()
      })
      chrome.send('Page.enable', () =>
        chrome.send('Debugger.enable', () => chrome.emit('Started'))
      )
    })

    ws.on('error', reject)

    ws.on('message', message => {
      const data = JSON.parse(message)

      if (!data.id || (data.id >= 0 && data.id < startId))
        sockets.forEach(s => s.send(message))

      if (data.method)
        chrome.emit(data.method, data.params)

      if (data.id && data.id >= startId && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.error, data.result)
        callbacks.delete(data.id)
      }
    })

    chrome.send = function(method, params, callback) {
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

function contextMenuWarning() {
  return `document.oncontextmenu = function(e) {
    window.alert('Opening developer tools will disconnect Wright.\\n\\nUse the window with the remote debugger instead')
    e.preventDefault()
    document.oncontextmenu = null
    return false
  }`
}
