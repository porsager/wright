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

    const server = http.createServer((req, res) => {
      delete req.headers['accept-encoding']

      const pathname = url.parse(req.url).pathname
          , ext = path.extname(pathname)

      if (handleJs(req, res) || handleCss(req, res))
        return

      if (config.external) {
        if (req.method === 'GET' && req.headers.accept.includes('html'))
          hijack(res)

        if (config.clone)
          clone(req, res)

        if (!ext || staticFiles.indexOf(ext) === -1)
          return proxy.web(req, res)
      }

      serveStatic(req, res, err => {
        serve.emit('get', path.join(config.serve, req.url))

        if (err && config.external)
          return proxy.web(req, res)

        if (err && !ext)
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    })

    module.exports.wss = new ws.Server({ server: server, path: '/wright' })

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/wright')
        return

      if (config.external)
        return proxy.ws(req, socket, head)

      socket.end()
    })

    server.on('listening', () => {
      injectedJs = config.js.filter(js => js.inject).map(js => js.path).map(scriptTag).join('')
      injectedCss = config.css.filter(css => css.inject).map(css => css.path).map(linkTag).join('')
      injectedSocket = socketTag(config.port)
      extraByteLength = Buffer.byteLength(injectedCss + injectedJs + injectedSocket, 'utf8')

      resolve()
    })

    server.on('error', reject)
    server.listen(config.port)
  })
  .then(() => config.external && utils.retryConnect(config.main, 5000))
  .then(() => log('Server ' + (config.external ? 'proxying' : 'started') + ' on ' + config.url))
}

function handleJs(req, res) {
  const pathname = url.parse(req.url).pathname

  if (path.extname(pathname) !== '.js')
    return

  const js = config.js.find(f => f.path === pathname)

  if (js) {
    utils.promisify(js.compile).then(jail).then(code => res.end(code)).catch(log.error)
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

  let hadFirstWrite = false
    , _statusCode
    , _writeHeadArgs

  res.write = function(buf) {
    if (hadFirstWrite)
      return _write.call(res, buf)

    hadFirstWrite = true

    const body = buf.toString()

    res.setHeader('Content-Length', Number(res.getHeader('content-length')) + extraByteLength)
    _writeHead.apply(res, _writeHeadArgs)
    _write.call(res, Buffer.from(body.replace('>', '>' + injectedCss)))
  }

  res.end = function(a) {
    if (hadFirstWrite)
      _write.call(res, injectedJs + injectedSocket)
    if (_statusCode && !res.headersSent)
      _writeHead.apply(res, _writeHeadArgs)

    _end.apply(res, arguments)
  }

  res.writeHead = function(statusCode, statusMessage, headers) {
    _writeHeadArgs = arguments
    _statusCode = statusCode
    // Don't writeHead from here, since we don't know yet if we should hijack
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
  return content.replace('>', '>' + injectedCss) + injectedJs + injectedSocket
}

function html(title) {
  return `<!DOCTYPE html>
<title>$ wright /${ title }</title>`
}

function socketTag(port) {
  return `\n<script id="wrightSocket">
(function() {
  document.getElementById('wrightSocket').remove()
  if (window.wright)
    return

  var socket = new WebSocket("ws://" + location.host + "/wright")
  socket.onmessage = function() { location.reload }
}())
</script>`
}

function scriptTag(file) {
  return '\n<script src="' + file + '" type="text/javascript" charset="utf-8"></script>'
}

function linkTag(file) {
  return '\n<link rel="stylesheet" type="text/css" href="' + file + '">'
}
