const os = require('os')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , WebSocket = require('ws')
    , childProcess = require('child_process')
    , utils = require('./utils')

const chrome = module.exports

chrome.open = function(options) {
  options.chromeUrl = 'http://' + options.debugHost + ':' + options.debugPort
  options.debugProxyPort = options.debugPort - 1

  return Promise.resolve(options)
  .then(launch)
  .then(waitForDebugger)
  .then(openTabs)
  .then(connectWs)
  .then(buildApi)

}

function launch(options) {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--new-window',
    '--user-data-dir=' + path.join(os.tmpdir(), '.chrome.wright-' + path.basename(process.cwd())),
    '--remote-debugging-port=' + (options.debugPort)
  ]

  childProcess.spawn(utils.chromePath, args, { detached: true }).unref()

  return options
}

function waitForDebugger(options) {
  return new Promise((resolve, reject) => {
    let retries = 0

    function ready() {
      utils.request(options.chromeUrl).then(() => resolve(options)).catch(() => {
        retries++
        if (retries < 100)
          setTimeout(ready, 50)
        else
          reject(new Error('Could not connect to remote debugging port'))
      })
    }

    ready()
  })
}

function openTabs(options) {
  let tabs

  return utils.request(options.chromeUrl + '/json/list/').then(allTabs => {
    tabs = allTabs

    const tab = tabs.find(t => t.url.startsWith(options.url.slice(0, -1)))
        , newTab = tabs.find(t => t.url === 'chrome://newtab/')

    if (newTab)
      utils.request(options.chromeUrl + '/json/close/' + newTab.id)

    if (tab)
      return tab

    return utils.request(options.chromeUrl + '/json/new?' + options.url)
  }).then(tab => {

    const devUrl = tab.devtoolsFrontendUrl.replace(':' + options.debugPort, ':' + options.debugProxyPort)

    const devTab = tabs.find(t => t.url.includes(':' + options.debugProxyPort + '/devtools/page'))

    if (devTab)
      utils.request(options.chromeUrl + '/json/close/' + devTab.id)

    utils.request(options.chromeUrl + '/json/new?' + encodeURIComponent(options.chromeUrl + devUrl)).then(() => {
      utils.request(options.chromeUrl + '/json/activate/' + options.tab.id)
    })

    options.tab = tab
    return options
  })

}

function connectWs(options) {
  return new Promise((resolve, reject) => {

    const ws = new WebSocket(options.tab.webSocketDebuggerUrl)
        , wss = new WebSocket.Server({ port: options.debugProxyPort })
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
      options.sendMessage({ method: 'Debugger.enable' }, (err, result) => {
        if (err)
          reject(err)
        else
          resolve(options)
      })
    })

    ws.on('message', data => {
      sockets.forEach(s => s.send(data))
      data = JSON.parse(data)

      if (data.method === 'Debugger.scriptParsed') {
        if (data.params.url)
          data.params.path = path.join(options.cwd, url.parse(data.params.url).path.substr(1))

        options.scripts(data.params)
      } else if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data.error, data.result)
        callbacks.delete(data.id)
      }
    })

    options.sendMessage = function(message, callback) {
      if (ws.readyState !== WebSocket.OPEN)
        return callback && callback({ message: 'Not connected' })

      message.id = id++
      ws.send(JSON.stringify(message))
      if (callback)
        callbacks.set(message.id, callback)
    }
  })
}

function buildApi(options) {
  const api = {
    replace: function(script, scriptSource, callback) {
      options.sendMessage({
        method: 'Debugger.setScriptSource',
        params: {
          scriptId: script.scriptId,
          scriptSource: scriptSource
        }
      }, callback)
    },

    insert: function(scriptSource) {
      options.sendMessage({
        method: 'Page.addScriptToEvaluateOnLoad',
        params: {
          scriptSource: scriptSource
        }
      }, (err, result) => {
        if (err)
          log(err)

        api.refresh()
      })
    },

    run: function(scriptSource, callback) {
      options.sendMessage({ method: 'Runtime.evaluate', params: { expression: scriptSource } }, callback)
    },

    refresh: function() {
      options.sendMessage({ method: 'Page.reload', params: { ignoreCache: true } })
    }
  }

  return api
}
