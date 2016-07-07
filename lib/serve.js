const fs = require('fs')
    , path = require('path')
    , http = require('http')
    , config = require('./config')
    , serveStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , log = require('./log')

module.exports = function() {
  if (!config.serve)
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

        finalHandler(req, res)(err)
      })
    })

    server.listen(config.port, config.host, () => {
      config.url = 'http://' + config.host + ':' + config.port
      log('Server started on ' + config.url)
      resolve()
    })

    server.on('error', reject)
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

function html(options) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>$ wright /${ options.title }</title>
  <link rel="stylesheet" type="text/css" href="/css/style.css">
</head>
<body>
  ${ options.js ? '<script src="/' + options.js + '" type="text/javascript" charset="utf-8"></script>' : '' }
</body>
</html>`
}
