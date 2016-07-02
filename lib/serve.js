const fs = require('fs')
    , path = require('path')
    , http = require('http')
    , config = require('./config')
    , serveStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , log = require('./log')

module.exports = function() {
  if (config.serve === null)
    return

  return new Promise((resolve, reject) => {
    const serve = serveStatic(config.serve, { redirect: false, fallthrough: false, index: false })

    const server = http.createServer((req, res) => {
      serve(req, res, err => {
        if (!err)
          finalHandler(req, res)

        if (config.main.endsWith('.js'))
          res.end(html({ title: path.basename(config.cwd), js: config.main }))
        else if (config.main.endsWith('.html'))
          res.end(fs.readFileSync(config.main, 'utf8'))
        else
          res.end(html({ title: path.basename(config.cwd) }))
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

function html(options) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>$ wright /${ options.title }</title>
  <link rel="stylesheet" type="text/css" href="/css/style.css">
</head>
<body>
  ${ options.js ? '<script src="' + options.js + '" type="text/javascript" charset="utf-8"></script>' : '' }
</body>
</html>`
}
