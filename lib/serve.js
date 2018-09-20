'use strict'

const fs = require('fs')
    , ws = require('ws')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , http = require('http')
    , jail = require('./jail')
    , clone = require('./clone')
    , utils = require('./utils')
    , config = require('./config')
    , httpProxy = require('http-proxy')
    , ServeStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , EventEmitter = require('events')

const serve = new EventEmitter()
    , staticFiles = '.html .js .css .svg .jpg .jpeg .png .gif'.split(' ')

let injectedJs
  , injectedCss
  , injectedSocket
  , extraByteLength

module.exports = serve

module.exports.start = function() {

  return new Promise((resolve, reject) => {

    const serveStatic = ServeStatic(config.serve, {
      etag        : false,
      fallthrough : Boolean(config.external && !config.clone),
      index       : config.external ? 'index.html' : false,
      setHeaders  : (res, localPath, stat) => serve.emit('get', localPath)
    })

    const proxy = config.external && httpProxy.createProxyServer({
      target        : 'http://' + url.parse(config.external).host,
      autoRewrite   : true,
      changeOrigin  : true,
      secure        : false
    })

    const corsy = httpProxy.createProxyServer({
      ignorePath: true,
      autoRewrite   : true,
      changeOrigin  : true,
      secure        : false
    })

    proxy && proxy.on('error', error)
    corsy && corsy.on('error', error)

    function error(err, req, res) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(err)
    }

    corsy.on('proxyRes', (proxyRes) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*'
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept'
    })

    const server = http.createServer((req, res) => {
      delete req.headers['accept-encoding']
      if (req.url.match(/^\/https?:\/\//))
        return corsy.web(req, res, { target: req.url.slice(1) })

      const pathname = url.parse(req.url).pathname
          , ext = path.extname(pathname)

      if (handleJs(req, res) || handleCss(req, res))
        return

      if (config.external) {
        if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('html'))
          hijack(res)

        if (config.clone)
          clone(req, res)

        if (!ext || staticFiles.indexOf(ext) === -1)
          return proxy.web(req, res)
      }

      serveStatic(req, res, err => {
        serve.emit('get', path.join(config.serve, req.url))

        if (config.external)
          return proxy.web(req, res)

        if (err)
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    })

    const wss = new ws.Server({ noServer: true, path: '/wright' })
    wss.on('connection', socket => socket.on('error', () => { /* noop */ }))

    module.exports.wss = wss

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/wright')
        return wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))

      if (config.external)
        return proxy.ws(req, socket, head)

      socket.end()
    })

    server.on('listening', () => {
      const injectAll = !config.external && !config.main.endsWith('.html')
      injectedJs = config.js.filter(js => injectAll || js.inject).map(js => js.path).map(scriptTag).join('')
      injectedCss = config.css.filter(css => injectAll || css.inject).map(css => css.path).map(linkTag).join('')
      injectedSocket = socketTag(config.port)
      extraByteLength = Buffer.byteLength(injectedCss + injectedJs + injectedSocket, 'utf8')

      resolve()
    })

    server.on('error', reject)
    server.listen(config.port)
  })
  .then(() => config.external && utils.retryConnect(config.external, 5000))
  .then(() => log('Server ' + (config.external ? 'proxying' : 'started') + ' on ' + config.url))
}

function handleJs(req, res) {
  const pathname = url.parse(req.url).pathname

  if (path.extname(pathname) !== '.js')
    return

  serve.emit('get', path.join(config.serve, req.url))

  const js = config.js.find(f => f.path === pathname)

  if (js) {
    utils.promisify(js.compile).then(content =>
      content.map
        ? content.code + '//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + Buffer.from(JSON.stringify(content.map)).toString('base64')
        : (content.code || content)
    ).then(jail).then(code => res.end(code)).catch(log.error)
    return true
  }

  const filePath = path.join(config.serve, pathname)

  if (!fs.existsSync(filePath))
    return false

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      err.status = err.statusCode = 404
      err.expose = false
      return finalHandler(req, res)(err)
    }

    res.setHeader('Content-Type', 'text/javascript')
    res.end(jail(content))
  })

  return true
}

function handleCss(req, res) {
  const pathname = url.parse(req.url).pathname

  if (path.extname(pathname) !== '.css')
    return

  const css = config.css.find(f => f.path === pathname)

  if (css) {
    res.setHeader('Content-Type', 'text/css')
    utils.promisify(css.compile).then(c => res.end(c)).catch(log.error)
    return true
  }
}

function hijack(res) {
  const _write = res.write
      , _end = res.end
      , _writeHead = res.writeHead

  let content = ''

  res.write = function(buf) {
    content += buf.toString()
  }

  res.end = function(a) {
    _write.call(res, addFiles(content))
    _end.apply(res, arguments)
  }

  res.writeHead = function() {
    res.setHeader('Content-Length', Number(res.getHeader('content-length')) + extraByteLength)
    _writeHead.apply(res, arguments)
  }
}

function sendHtml(res) {
  if (config.main.endsWith('.js'))
    return res.end(html(config.name) + scriptTag(config.main))

  if (!config.main.endsWith('.html'))
    return res.end(addFiles(html(config.name)))

  fs.readFile(config.main, 'utf8', (err, content) => {
    if (err)
      return log.error('Error reading', config.main, err)

    res.end(addFiles(content))
  })
}

function addFiles(content) {
  return (content.includes('<meta charset')
    ? content.replace(/(<meta charset.*?>)/i, '$1' + injectedCss + injectedSocket)
    : content.replace('>', '>' + injectedCss + injectedSocket)
  ) + injectedJs
}

function html(title) {
  return `<!DOCTYPE html><title>$ wright /${ title }</title><body></body>`
}

const pws = fs.readFileSync(require.resolve('pws/index.js'), 'utf8')

function socketTag(port) {
  return `\n<script id="wrightSocket">
  ${ pws }
;(function() {
  window.p = window.p || function(first) {
    console.log.apply(console, arguments)
    return first
  }

  var el = document.getElementById('wrightSocket')

  if (el)
    el.parentNode.removeChild(el)

  var socket = new PersistentWebSocket("ws://" + location.host + "/wright")
  var opened = false
  socket.onmessage = function() { !window.wright && location.reload() }
  socket.onopen = function() {
    opened && location.reload()
    opened = true
  }
}());
</script>\n`
}

function scriptTag(file) {
  return '\n<script src="' + file + '" type="text/javascript" charset="utf-8"></script>'
}

function linkTag(file) {
  return '\n<link rel="stylesheet" type="text/css" href="' + file + '">'
}
