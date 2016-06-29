const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , utils = require('./utils')
    , chokidar = require('chokidar')
    , server = require('./server')
    , chrome = require('./chrome')
    , reload = require('./reload')

const graphics = new Set(['.jpg', '.png', '.gif', '.webm', '.svg'])
    , fonts = new Set(['.woff', '.ttf'])

const options = {
  main        : null,
  reload      : null,
  host        : 'localhost',
  port        : 3000,
  debugHost   : 'localhost',
  debugPort   : 9222
}

module.exports = function(config = {}) {

  Object.keys(config).forEach(key => {
    options[key] = config[key]
  })

  options.scripts = utils.Stream()

  if (typeof options.main === 'number')
    options.url = 'http://localhost:' + options.main
  else if (options.main.startsWith('http://'))
    options.url = options.main

  if (!options.url && options.main.endsWith('index.html'))
    options.cwd = path.join(process.cwd(), path.dirname(options.main))
  else
    options.cwd = process.cwd()

  return Promise.resolve(options)
  .then(options.url ? o => o : server)
  .then(chrome.open)
  .then(connection => {

    const wright = {
      refresh: connection.refresh,
      inject: (script, scriptSource) => {
        if (!scriptSource && !options.script)
          return connection.insert(script)

        if (!scriptSource) {
          scriptSource = script
          script = options.script
        }

        connection.replace(script, scriptSource, (err, result) => {
          if (err) {
            connection.refresh()
            log('Failed hot reload ' + path.relative(options.cwd, script.scriptId) + ' refreshed instead')
          } else {
            connection.run(options.reload)
            log('Hot reloaded ' + script.path ? path.relative(options.cwd, script.path) : 'injected script')
          }
        })
      },
      reload: (file) => {
        const ext = path.extname(file)

        log('change', file)
        if (ext === '.html')
          connection.refresh()
        else if (ext === '.css')
          connection.run(reload.css(file))
        else if (graphics.has(ext))
          connection.run(reload.images(file))
        else if (fonts.has(ext))
          connection.run(reload.fonts(file))
      }
    }

    options.scripts.map(script => {
      if (!script.path)
        return options.script = script

      log('Watching script: ' + path.relative(options.cwd, script.path))
      chokidar.watch(script.path, { ignoreInitial: true }).on('change', path => {
        if (options.reload)
          wright.inject(script, fs.readFileSync(script.path, 'utf8'))
        else
          wright.refresh()
      })
    })

    chokidar.watch(options.cwd, {
      ignoreInitial: true
    }).on('all', (type, file) => {
      wright.reload(path.relative(options.cwd, file))
    })

    return wright

  })

}
