const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , http = require('http')
    , jail = require('./jail')
    , utils = require('./utils')
    , config = require('./config')
    , ServeStatic = require('serve-static')
    , finalHandler = require('finalhandler')

const resolved = Promise.resolve()

module.exports = function() {
  if (config.external)
    return

  return new Promise((resolve, reject) => {
    const serveStatic = ServeStatic(config.serve, {
      etag: false,
      fallthrough: false,
      index: false
    })

    const server = http.createServer((req, res) => {
      if (path.extname(req.url) === '.js')
        return handleJs(req, res)

      if (path.extname(req.url) === '.css') {
        const css = config.css.find(f => f.path === req.url)

        res.setHeader('Content-Type', 'text/css')
        if (css)
          return resolved.then(css.compile).then(c => res.end(c)).catch(log.error)
      }

      serveStatic(req, res, err => {
        if (err && !path.extname(req.url))
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    })

    server.on('listening', () => {
      if (config.port !== 80)
        config.url = 'http://localhost:' + config.port

      log('Server started on ' + config.url)
      resolve()
    })

    server.on('error', reject)

    utils.nextFreePort(config.port).then(port => {
      config.port = port
      server.listen(port)
    }).catch(reject)
  })
}

function handleJs(req, res) {
  const js = config.js.find(f => f.path === req.url)

  if (js)
    return resolved.then(js.compile).then(jail).then(code => res.end(code)).catch(log.error)

  fs.readFile(path.join(config.serve, req.url), 'utf8', (err, content) => {
    if (err) {
      err.status = err.statusCode = 404
      err.expose = false
      return finalHandler(req, res)(err)
    }

    res.setHeader('Content-Type', 'text/javascript')
    res.end(jail(content))
  })
}

function sendHtml(res) {
  if (!config.main.endsWith('.html'))
    return res.end(addFiles(html(config.name)))

  fs.readFile(config.main, 'utf8', (err, content) => {
    if (err)
      return log.error('Error reading', config.main, err)

    res.end(addFiles(content))
  })
}

function addFiles(content) {
  const scriptTags = config.js.map(scriptTag).join('')
      , linkTags = config.css.map(linkTag).join('')

  return content.replace('</head>', linkTags + '</head>')
                .replace('</body>', scriptTags + '</body>')
}

function html(title) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>$ wright /${ title }</title>
  <base href="/">
</head>
<body>
</body>
</html>`
}

function scriptTag(file) {
  return '<script src="' + file.path + '" type="text/javascript" charset="utf-8"></script>\n'
}

function linkTag(file) {
  return '<link rel="stylesheet" type="text/css" href="' + file.path + '">\n'
}
