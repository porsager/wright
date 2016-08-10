'use strict'

const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')
    , chokidar = require('chokidar')

let script = null
  , style = null
  , scriptId = null

module.exports = function(chrome) {

  let init = Promise.resolve()

  if (config.js) {
    chokidar.watch(config.js.watch, config.js.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.js.compile).then(injectJs).catch(log)
    })

    init = init.then(config.js.compile).then(injectJs).catch(log)
  } else {
    chrome.send('Page.reload', { ignoreCache: true })
  }

  if (config.css) {
    chokidar.watch(config.css.watch, config.css.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.css.compile).then(injectCss).catch(log)
    })

    init.then(config.css.compile).then(injectCss).catch(log)
  }

  function injectJs(source) {
    return new Promise((resolve, reject) => {
      if (!script) {
        chrome.send('Page.addScriptToEvaluateOnLoad', {
          scriptSource: source
        }, (err, result) => {
          if (err)
            return log(err)

          scriptId = result.identifier
          chrome.send('Page.reload', { ignoreCache: true }, () => {
            chrome.on('Debugger.scriptParsed', (s) => {
              if (!s.isInternalScript)
                script = s
            })
            setTimeout(resolve, 100)
          })
        })
        return
      }

      chrome.send('Page.removeScriptToEvaluateOnLoad', {
        identifier: scriptId
      }, (err, result) => {
        if (err)
          return log(err)

        chrome.send('Page.addScriptToEvaluateOnLoad', {
          scriptSource: source
        }, (err, result) => {
          if (err)
            return log(err)

          scriptId = result.identifier
        })
      })

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
      chrome.once('Page.loadEventFired', (r) => {
        style = null
        Promise.resolve().then(config.css.compile).then(injectCss).catch(log)
      })
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
