'use strict'

const fs = require('fs')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , http = require('http')
    , jail = require('./jail')
    , utils = require('./utils')
    , config = require('./config')
    , httpProxy = require('http-proxy')
    , ServeStatic = require('serve-static')
    , finalHandler = require('finalhandler')

let injectedJs
  , injectedCss
  , extraByteLength

module.exports = function() {

  injectedJs = config.js.filter(js => js.inject).map(scriptTag).join('')
  injectedCss = config.css.filter(css => css.inject).map(linkTag).join('')
  extraByteLength = Buffer.byteLength(injectedCss + injectedJs, 'utf8')

  return new Promise((resolve, reject) => {

    const serveStatic = ServeStatic(config.serve, {
      etag        : false,
      fallthrough : Boolean(config.external),
      index       : false
    })

    const proxy = httpProxy.createProxyServer({
      target        : config.external,
      autoRewrite   : true,
      changeOrigin  : true,
      secure        : false,
      ws            : true
    })

    proxy.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head))

    const server = http.createServer((req, res) => {
      if (handleJs(req, res) || handleCss(req, res))
        return

      serveStatic(req, res, err => {
        if (config.external) {
          if (req.method === 'GET' && (injectedJs || injectedCss))
            hijack(res)

          return proxy.web(req, res)
        }

        if (err && !path.extname(url.parse(req.url).pathname))
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    })

    server.on('listening', () => {
      if (config.port !== 80)
        config.url = 'http://localhost:' + config.port

      resolve()
    })

    server.on('error', reject)

    utils.nextFreePort(config.port).then(port => {
      config.port = port
      server.listen(port)
    }).catch(reject)
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

  let html = null
    , hadFirstWrite = false
    , _statusCode
    , _headers

  res.write = function(buf) {
    if (hadFirstWrite)
      return _write.call(res, buf)

    hadFirstWrite = true

    const string = buf.toString()

    html = string.toLowerCase().startsWith('<!doctype html>')

    if (html) {
      res.setHeader('Content-Length', Number(res.getHeader('content-length')) + extraByteLength)
      _writeHead.call(res, _statusCode, _headers)
      _write.call(res, string.replace('>', '>' + injectedCss))
    } else {
      _writeHead.call(res, _statusCode, _headers)
      _write.call(res, buf)
    }
  }

  res.end = function(a) {
    if (hadFirstWrite)
      _write.call(res, html ? injectedJs : '')
    else if (_statusCode)
      _writeHead.call(res, _statusCode, _headers)

    _end.apply(res, arguments)
  }

  res.writeHead = function(statusCode, headers) {
    _statusCode = statusCode
    _headers = headers
    // Don't writeHead from here, since we don't know yet if we should hijack
  }
}

function sendHtml(res) {
  if (!config.main.endsWith('.html') || config.main.endsWith('.js'))
    return res.end(addFiles(html(config.name)))

  fs.readFile(config.main, 'utf8', (err, content) => {
    if (err)
      return log.error('Error reading', config.main, err)

    res.end(addFiles(content))
  })
}

function addFiles(content) {
  return content.replace('>', '>' + injectedCss) + injectedJs
}

function html(title) {
  return `<!DOCTYPE html>
<title>$ wright /${ title }</title>`
}

function scriptTag(file) {
  return '\n<script src="' + file.path + '" type="text/javascript" charset="utf-8"></script>'
}

function linkTag(file) {
  return '\n<link rel="stylesheet" type="text/css" href="' + file.path + '">'
}
