const fs = require('fs')
    , path = require('path')
    , http = require('http')
    , serveStatic = require('serve-static')
    , finalHandler = require('finalhandler')
    , log = require('./log')

module.exports = function serve(options) {

  return new Promise((resolve, reject) => {
    if (!options.main)
      options.html = html({ title: path.basename(project.cwd()) })
    else if (options.main.endsWith('.js'))
      options.html = html({ title: path.basename(project.cwd()), js: options.main })
    else if (options.main.endsWith('.html'))
      options.html = fs.readFileSync(options.main, 'utf8')
    else
      return reject(new Error('Please provide a .js or .html file'))

    const serve = serveStatic(options.cwd, { redirect: false, fallthrough: false, index: false })

    const server = http.createServer((req, res) => {
      serve(req, res, err => {
        if (err)
          res.end(options.html)
        else
          finalHandler(req, res)
      })
    })

    server.listen(options.port, options.host, () => {
      options.url = 'http://' + options.host + ':' + options.port
      log('Server started on ' + options.url)
      resolve(options)
    })

    server.on('error', reject)
  })
}

function html(options) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${ options.title }</title>
  <link rel="stylesheet" type="text/css" href="/css/style.css">
</head>
<body>
  ${ options.js ? '<script src="' + options.js + '" type="text/javascript" charset="utf-8"></script>' : '' }
</body>
</html>`
}
