const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , chokidar = require('chokidar')
    , config = require('./config')

const scripts = new Map()

module.exports = function() {
  config.api.watch = chokidar.watch(config.watch, {
    ignoreInitial: true
  }).on('all', (type, file) => config.api.reload(file))

  config.scripts.map(script => {
    if (config.debug)
      log('Found script ', script)

    if (!script.path)
      return config.script = script

    if (!scripts.has(script.path))
      watchScript(script)

    scripts.set(script.path, script)
  })
}

function watchScript(script) {
  log('Watching script: ' + path.relative(config.watch, script.path))
  chokidar.watch(script.path, { ignoreInitial: true }).on('change', scriptChanged)
}

function scriptChanged(path) {
  const script = scripts.get(path)

  if (config.run)
    config.api.inject(script, fs.readFileSync(script.path, 'utf8'))
  else
    config.api.refresh()
}
