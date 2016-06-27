const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , chokidar = require('chokidar')
    , server = require('./server')
    , chrome = require('./chrome')
    , reload = require('./reload')

const scripts = new Map()

const options = {
  main        : null, // src/js/app.js
  reload      : null, // window.redraw()
  host        : 'localhost',
  port        : 3000,
  debugHost   : 'localhost',
  debugPort   : 9222
}

module.exports = function(main, config = {}) {

  Object.keys(config).forEach(key => {
    options[key] = config[key]
  })

  options.main = main

  if (typeof options.main === 'number')
    options.url = 'http://localhost:' + options.main

  options.cwd = path.join(process.cwd(), options.url ? '' : path.dirname(options.main))

  return Promise.resolve(options)
  .then(options.url ? o => o : server)
  .then(chrome.open)
  .then(connection => {

    const wright = {
      refresh: connection.refresh,
      replace: (script, scriptSource) => {
        if (!scripts.size)
          return log('No scripts loaded - nothing to replace')

        if (scriptSource === undefined) {
          scriptSource = script
          script = options.scripts[0]
        }

        connection.replace(script, scriptSource, (err, result) => {
          if (err) {
            connection.refresh()
            log('Failed hot reload ' + path.relative(process.cwd(), script.path) + ' refreshed instead')
          } else {
            connection.run(options.reload)
            log('Hot reloaded ' + path.relative(process.cwd(), script.path))
          }
        })
      },
      reload: (type, file) => {
        file = path.relative(options.cwd, file)
        if (file.endsWith('.html'))
          connection.refresh()
        else if (file.endsWith('.css'))
          connection.run(reload.css(file))
        else if (/\.(jpg|png|gif|webm|svg)$/.test(file))
          connection.run(reload.images(file))
        else if (/matchfonts/.test(file))
          connection.run(reload.fonts(file))
      }
    }

    options.scriptParsed = function(script) {
      if (scripts.has(script.path))
        return scripts.set(script.path, script)

      log('Watching script: ' + path.relative(options.cwd, script.path))
      scripts.set(script.path, script)
      chokidar.watch(script.path, { ignoreInitial: true }).on('change', path => {
        if (options.reload)
          wright.replace(scripts.get(path), fs.readFileSync(script.path, 'utf8'))
        else
          wright.refresh()
      })
    }

    chokidar.watch(options.cwd, {
      ignored: '**/node_modules/**',
      ignoreInitial: true
    }).on('all', wright.reload)

    return wright

  })

}
