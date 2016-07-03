const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , chokidar = require('chokidar')
    , config = require('./config')

module.exports = function() {
  config.scripts.map(script => {
    if (config.verbose)
      log('Found script ', script)

    if (!script.path)
      return config.script = script

    log('Watching script: ' + path.relative(config.watch, script.path))
    chokidar.watch(script.path, { ignoreInitial: true }).on('change', path => {
      if (config.run)
        config.api.inject(script, fs.readFileSync(script.path, 'utf8'))
      else
        config.api.refresh()
    })
  })

  config.api.watch = chokidar.watch(config.watch, {
    ignoreInitial: true
  }).on('all', (type, file) => config.api.reload(file))
}
