'use strict'

const fs = require('fs')
    , log = require('./log')
    , config = require('./config')
    , chokidar = require('chokidar')

let script = null
  , scriptId = null
  , styleSheetId = null
  , styleSource = ''

module.exports = function(chrome) {

  if (config.js) {
    chokidar.watch(config.js.watch, config.js.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.js.compile).then(injectJs).catch(log)
    })

    Promise.resolve().then(config.js.compile).then(injectJs).catch(log)
  } else {
    chrome.send('Page.reload', { ignoreCache: true })
  }

  if (config.css) {
    chrome.on('Page.loadEventFired', (r) => {
      chrome.once('CSS.styleSheetAdded', function added(style) {
        if (style.header.title === 'WrightInjected') {
          styleSheetId = style.header.styleSheetId
          chrome.removeListener('CSS.styleSheetAdded', added)
        }
      })
      chrome.send('Runtime.evaluate', {
        expression: appendStylesheet(styleSource || '')
      }, log.error)
    })

    chokidar.watch(config.css.watch, config.css.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.css.compile).then(injectCss).catch(log)
    })

    Promise.resolve().then(config.css.compile).then(injectCss).catch(log)
  }

  function injectJs(source) {
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
      if (err) {
        log('Failed hot reloading injected script - refreshed instead')
        log.debug(err)
        return
      }

      if (config.run) {
        chrome.send('Runtime.evaluate', { expression: getScript(config.run) }, log.debug)
        log('Reloaded injected script')
      } else {
        chrome.send('Page.reload', { ignoreCache: true }, log.debug)
      }
    })
  }

  function injectCss(source) {
    styleSource = source

    if (!styleSheetId)
      return

    chrome.send('CSS.setStyleSheetText', {
      styleSheetId: styleSheetId,
      text: source
    }, (err, result) => {
      if (err)
        return log(err)

      log('Reloaded injected style')
      log.debug(err, result)
    })
  }

  return chrome

}

function getScript(source) {
  return source.endsWith('.js') ? fs.readFileSync(config.run, 'utf8') : source
}

function appendStylesheet(source) {
  return `var style = document.createElement('style')
    style.type = 'text/css'
    style.title = 'WrightInjected'
    style.appendChild(document.createTextNode(\`${ source }\`))
    document.head.appendChild(style)
  `
}
