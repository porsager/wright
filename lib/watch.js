const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , chokidar = require('chokidar')
    , config = require('./config')

module.exports = function() {
  config.scripts.map(script => {
    if (!script.path)
      return config.script = script

    log('Watching script: ' + path.relative(config.cwd, script.path))
    chokidar.watch(script.path, { ignoreInitial: true }).on('change', path => {
      if (config.reload)
        config.chrome.inject(script, fs.readFileSync(script.path, 'utf8'))
      else
        config.chrome.refresh()
    })
  })

  chokidar.watch(config.cwd, {
    ignoreInitial: true
  }).on('all', (type, file) => config.api.reload(file))
}
