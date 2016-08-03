const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')

module.exports = function(chrome) {
  config.api = {
    refresh: chrome.refresh,
    inject: (script, scriptSource) => {
      if (!scriptSource && !config.script)
        return chrome.insert(script)

      if (!scriptSource) {
        scriptSource = script
        script = config.script
      }

      chrome.replace(script, scriptSource, (err, result) => {
        const scriptPath = script.path ? path.relative(config.cwd, script.path) : 'injected script'

        if (err)
          return console.log('Error hot reloading script\n', err)

        chrome.run(config.run.endsWith('.js') ? fs.readFileSync(config.run, 'utf8') : config.run)
        log('Hot reloaded ' + scriptPath)
      })
    }
  }

  if (config.watch) {
    config.api.watch = require('chokidar').watch(config.watch, {
      ignoreInitial: true
    })
  }
}
