'use strict'

const fs = require('fs-extra')
    , ws = require('ws')
    , URL = require('url')
    , log = require('./log')
    , path = require('path')
    , http = require('http')
    , jail = require('./jail')
    , Ubre = require('ubre')
    , cp = require('child_process')
    , clone = require('./clone')
    , utils = require('./utils')
    , config = require('./config')
    , httpProxy = require('http-proxy')
    , ServeStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , EventEmitter = require('events')
    , SourceMap = require('source-map')
    , assets = require('./watch/assets')

const serve = new EventEmitter()
    , staticFiles = '.html .js .css .svg .jpg .jpeg .png .gif'.split(' ')
    , sourceMaps = {}
    , modulesPath = '/wright/modules/'
    , browserClient = fs.readFileSync(path.join(__dirname, './browser/wright.js'), 'utf8')
    , browserClientMap = fs.readFileSync(path.join(__dirname, './browser/wright.js.map'), 'utf8')
    , injectedWright = '<script type="text/javascript" id="wrightSocket" charset="utf-8" src="/wright.js"></script>'
    , isModuleRegex = /(^\s*|[}\);\n]\s*)(import\s*\(?(['"]|(\*[\s\S]+as[\s\S]+)?(?!type)([^"'\(\)\n;]+)[\s\S]*from[\s\S]*['"]|\{)|export\s\s*(['"]|(\*[\s\S]+as[\s\S]+)?(?!type)([^"'\(\)\n;]+)[\s\S]*from[\s\S]*['"]|\{|default|function|class|var|const|let|async[\s\S]+function|async[\s\S]+\())/
    , staticImportRegex = new RegExp('(import\\s*[{}0-9a-zA-Z*,\\s]*\\s*(?: from |)[\'"])([a-zA-Z1-9@][a-zA-Z0-9@/._-]*)([\'"])', 'g')
    , dynamicImportRegex = new RegExp('(import\\([\'"])([a-zA-Z1-9@][a-zA-Z0-9@/._-]*)([\'"]\\))', 'g')

let injectedJs
  , injectedCss
  , extraByteLength

module.exports = serve

module.exports.start = function() {

  return new Promise((resolve, reject) => {

    const serveOptions = {
      etag        : false,
      fallthrough : Boolean(config.external && !config.clone),
      index       : config.external ? 'index.html' : false,
      setHeaders  : (res, localPath, stat) => res.setHeader('Cache-Control', 'no-store, must-revalidate')
    }

    const serveStatic = ServeStatic(config.serve, serveOptions)

    const assetServes = config.assets.map(a => ServeStatic(a, serveOptions))

    const proxy = config.external && httpProxy.createProxyServer({
      target        : 'http://' + URL.parse(config.external).host,
      autoRewrite   : true,
      changeOrigin  : true,
      secure        : false
    })

    const corsy = httpProxy.createProxyServer({
      autoRewrite     : true,
      changeOrigin    : true,
      secure          : false,
      followRedirects : true
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

      if (req.url === '/wright.js')
        return res.end(browserClient)

      if (req.url === '/wright.js.map')
        return res.end(browserClientMap)

      if (req.url.startsWith(modulesPath))
        return modules(req, res)

      if (req.url.match(/^\/https?:\/\//))
        return corsy.web(req, res, { target: req.url.slice(1) })

      const pathname = URL.parse(req.url).pathname
          , ext = path.extname(pathname)

      if (handleJs(req, res) || handleCss(req, res))
        return

      if (sourceMap(req, res))
        return

      if (config.external) {
        if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('html'))
          hijack(res)

        if (config.clone)
          clone(req, res)

        if (!ext || staticFiles.indexOf(ext) === -1)
          return proxy.web(req, res)
      }

      req.assetServe = 0
      tryServe(ext, serveStatic, req, res)
    })

    function tryServe(ext, serveStatic, req, res) {
      serveStatic(req, res, err => {
        if (req.assetServe < assetServes.length)
          return tryServe(ext, assetServes[req.assetServe++], req, res)

        if (config.external)
          return proxy.web(req, res)

        if (ext)
          assets.watch(path.join(config.serve, req.url))

        if (err)
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    }

    const wss = new ws.Server({ noServer: true, path: '/wright' })
    const ubre = Ubre.wss(wss)

    wss.on('connection', (socket, req) => {
      const ub = ubre(socket)

      ub.subscribe('error', err => {
        err.userAgent = req.headers['user-agent']
        err.ip = req.connection.remoteAddress
        log('Client error: ', err)
      })

      ub.subscribe('goto', ({
        url,
        line,
        column
      }) => {
        const filename = URL.parse(url).pathname
        const file = sourceMaps[filename + '.map']
        if (!file)
          return // utils.launchEditor(path.join(config.serve, filename) + ':' + line + ':' + column)

        SourceMap.SourceMapConsumer.with(file, null, consumer => {
          const result = consumer.originalPositionFor({
            line: parseInt(line),
            column: parseInt(column)
          })
          utils.launchEditor(result.source + ':' + result.line + ':' + result.column, config.editor)
        })
      })
      socket.on('error', () => { /* noop */ })
    })

    module.exports.ubre = ubre

    server.on('upgrade', (req, socket, head) => {
      if (req.url === '/wright')
        return wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))

      if (config.external)
        return proxy.ws(req, socket, head)

      socket.end()
    })

    server.on('listening', () => {
      const injectAll = !config.external && !config.main.endsWith('.html')
      injectedJs = config.js.filter(js => injectAll || js.inject).map(js => js.path).map(x => scriptTag(x)).join('')
      injectedCss = config.css.filter(css => injectAll || css.inject).map(css => css.path).map(linkTag).join('')
      extraByteLength = Buffer.byteLength(injectedCss + injectedJs + injectedWright, 'utf8')

      resolve()
    })

    server.on('error', reject)
    server.listen(config.port)
  })
  .then(() => config.external && utils.retryConnect(config.external, 5000))
  .then(() => log('Server ' + (config.external ? 'proxying' : 'started') + ' on ' + config.url))
}

function handleJs(req, res) {
  const pathname = URL.parse(req.url).pathname
  if (path.extname(pathname) !== '.js')
    return

  res.setHeader('Content-Type', 'application/javascript')
  assets.watch(path.join(config.serve, req.url))

  const js = config.js.find(f => f.path && f.path.toLowerCase() === pathname.toLowerCase())
  if (js) {
    utils.promisify(js.compile).then(content => {
      if (content.map)
        sourceMaps[js.path + '.map'] = content.map

      res.setHeader('SourceMap', js.path + '.map')
      return content.map
        ? content.code + '\n//# sourceMappingURL=' + js.path + '.map'
        : (content.code || content)
    }).then(jail).then(code => res.end(code)).catch(log.error)
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
    res.end(jail(unpkg(content)))
  })

  return true
}

function unpkg(content) {
  if (!isModuleRegex.test(content))
    return content

  return content
    .replace(staticImportRegex, '$1/wright/modules/$2$3')
    .replace(dynamicImportRegex, '$1/wright/modules/$2$3')
}

function modules(req, res) {
  const pkgName = req.url.slice(modulesPath.length)
      , pkgBaseName = pkgName.split('@')[0]

  const pkgBase = path.join(process.cwd(), 'node_modules', pkgBaseName)

  fs.readFile(path.join(pkgBase, 'package.json'), 'utf8').then(JSON.parse)
    .then(x => x.module || x.browser || x.unpkg || x.main || 'index.js')
    .catch(() => 'index.js')
    .then(x => fs.readFile(path.join(pkgBase, x), 'utf8'))
    .then(x => {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(x)
    })
    .catch(x => {
      cp.exec('npm install ' + pkgName, { encoding: 'utf8' }, (err, stdout, stderr) => {
        if (!err && stdout.includes('added 1 package'))
          return modules(req, res)

        res.statusCode = 500
        res.end(String(err || stderr))
      })
    })
}

function sourceMap(req, res) {
  if (req.url in sourceMaps) {
    res.end(JSON.stringify(sourceMaps[req.url]))
    return true
  }
}

function handleCss(req, res) {
  const pathname = URL.parse(req.url).pathname

  if (path.extname(pathname) !== '.css')
    return

  res.setHeader('Content-Type', 'text/css')
  const css = config.css.find(f => f.path && f.path.toLowerCase() === pathname.toLowerCase())

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
    return res.end(addFiles(html(config.name) + scriptTag(config.main.replace(config.serve, ''), true)))

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
    ? content.replace(/(<meta charset.*?>)/i, '$1' + injectedCss + injectedWright)
    : content.replace('>', '>' + injectedCss + injectedWright)
  ) + injectedJs
}

function html(title) {
  return `<!DOCTYPE html><title>$ wright /${ title }</title><body></body>`
}

function scriptTag(file, module) {
  return '\n<script src="' + file + '" type="' + (module ? 'module' : 'text/javascript') + '" charset="utf-8"></script>'
}

function linkTag(file) {
  return '\n<link rel="stylesheet" type="text/css" href="' + file + '">'
}
