const fs = require('fs')
    , path = require('path')
    , http = require('http')
    , config = require('./config')
    , serveStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , log = require('./log')
    , utils = require('./utils')

module.exports = function() {
  if (!config.serve || config.main.startsWith('http://'))
    return

  return new Promise((resolve, reject) => {
    const serve = serveStatic(config.serve, {
      etag: false,
      fallthrough: false,
      index: config.main.endsWith('.html') ? config.main : undefined
    })

    const server = http.createServer((req, res) => {
      serve(req, res, err => {
        if (err && !path.extname(req.url))
          return sendHtml(res)

        finalHandler(req, res)(err)
      })
    })

    server.on('listening', () => {
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

function sendHtml(res) {
  if (config.main.endsWith('.html')) {
    fs.readFile(config.main, 'utf8', (err, content) => {
      if (err)
        return log.error('Error reading', config.main, err)

      res.end(content)
    })
  } else if (config.files.some(f => f.endsWith('.js') || f.endsWith('.css'))) {
    res.end(html({
      title: path.basename(config.cwd),
      js: config.files.filter(f => path.extname(f) === '.js').map(scriptTag).join('\n'),
      css: config.files.filter(f => path.extname(f) === '.css').map(linkTag).join('\n')
    }))
  } else {
    res.end(html({ title: path.basename(config.cwd) }))
  }
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
  <link id="favicon" rel="shortcut icon" type="image/png" href="">
  <base href="/">
  ${ options.css }
</head>
<body>
  ${ options.js }
</body>
</html>`
}

function scriptTag(file) {
  return '<script src="/' + file + '" type="text/javascript" charset="utf-8"></script>'
}

function linkTag(file) {
  return '<link rel="stylesheet" type="text/css" href="/' + file + '">'
}
