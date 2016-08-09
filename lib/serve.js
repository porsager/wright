const fs = require('fs')
    , path = require('path')
    , http = require('http')
    , config = require('./config')
    , serveStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , log = require('./log')

module.exports = function() {
  if (!config.serve || config.main.startsWith('http://'))
    return

  return new Promise((resolve, reject) => {
    const serve = serveStatic(config.serve, {
      etag: false,
      fallthrough: false
    })

    const server = http.createServer((req, res) => {
      serve(req, res, err => {
        if (err && !path.extname(req.url))
          return sendHtml(res)

        if (err && req.url === '/favicon.ico')
          return sendFavicon(res)

        finalHandler(req, res)(err)
      })
    })

    server.on('listening', () => {
      config.url = 'http://localhost:' + config.port
      log('Server started on ' + config.url)
      resolve()
    })

    server.on('error', reject)
    server.listen(config.port)
  })
}

function sendHtml(res) {
  if (config.main.endsWith('.js'))
    res.end(html({ title: path.basename(config.cwd), js: config.main }))
  else if (config.main.endsWith('.html'))
    res.end(fs.readFileSync(config.main, 'utf8'))
  else
    res.end(html({ title: path.basename(config.cwd) }))
}

function sendFavicon(res) {
  res.statusCode = 404
  res.end('Not Found')
}

function html(options) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>$ wright /${ options.title }</title>
  <base href="/">
</head>
<body>
  ${ options.js ? '<script src="/' + options.js + '" type="text/javascript" charset="utf-8"></script>' : '' }
</body>
</html>`
}
