const log = require('../log')

module.exports = function(send) {
  return {
    send: send,
    replace: function(script, scriptSource, callback) {
      send('Debugger.setScriptSource', {
        scriptId: script.scriptId,
        scriptSource: scriptSource
      }, callback)
    },

    insert: function(scriptSource) {
      send('Page.addScriptToEvaluateOnLoad', {
        scriptSource: scriptSource
      }, (err, result) => {
        if (err)
          log(err)

        send('Page.reload')
      })
    },

    run: function(scriptSource, callback) {
      send('Runtime.evaluate', { expression: scriptSource }, callback)
    },

    refresh: function() {
      send('Page.reload', { ignoreCache: true })
    }
  }
}
