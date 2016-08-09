const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')
    , chokidar = require('chokidar')

let script = null
  , style = null

module.exports = function(chrome) {

  let init = Promise.resolve()

  if (config.js) {
    chokidar.watch(config.js.path, config.js.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.js.promise).then(injectJs).catch(log)
    })

    init = init.then(config.js.promise).then(injectJs)
  } else {
    chrome.send('Page.reload', { ignoreCache: true })
  }

  if (config.css) {
    chokidar.watch(config.css.path, config.css.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.css.promise).then(injectCss).catch(log)
    })

    init.then(config.css.promise).then(injectCss)
  }

  function injectJs(source) {
    return new Promise((resolve, reject) => {
      if (!script) {
        chrome.send('Page.addScriptToEvaluateOnLoad', {
          scriptSource: source
        }, (err, result) => {
          if (err)
            return log(err)

          chrome.send('Page.reload', { ignoreCache: true }, () => {
            chrome.once('Debugger.scriptParsed', s => script = s)
            setTimeout(resolve, 100)
          })
        })
        return
      }

      chrome.send('Debugger.setScriptSource', {
        scriptId: script.scriptId,
        scriptSource: source
      }, (err, result) => {
        const scriptPath = script.path ? path.relative(config.cwd, script.path) : 'injected script'

        if (err) {
          log('Failed hot reloading ' + scriptPath + ' refreshed instead')
          return reject(err)
        }

        if (config.run) {
          chrome.send('Runtime.evaluate', { expression: getScript(config.run) }, resolve)
          log('Hot reloaded ' + scriptPath)
        } else {
          chrome.send('Page.reload', { ignoreCache: true }, resolve)
        }
      })

    })
  }

  function injectCss(source) {
    if (!style) {
      chrome.once('CSS.styleSheetAdded', s => style = s.header)
      chrome.send('Runtime.evaluate', {
        expression: appendStylesheet(source)
      }, log.error)
      return
    }

    style.text = source
    chrome.send('CSS.setStyleSheetText', {
      styleSheetId: style.styleSheetId,
      text: source
    }, log.error)
  }

  return chrome

}

function getScript(source) {
  return source.endsWith('.js') ? fs.readFileSync(config.run, 'utf8') : source
}

function appendStylesheet(source) {
  return `var style = document.createElement('style')
    style.type = 'text/css'
    style.appendChild(document.createTextNode(\`${ source }\`))
    document.head.appendChild(style)
  `
}
