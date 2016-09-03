'use strict'

const log = require('./log')
    , config = require('./config')
    , chokidar = require('chokidar')
    , jail = require('./jail')

let script = null
  , scriptId = null
  , styleSheetId = null
  , styleSource = ''
  , contextId = null

module.exports = function(chrome) {

  if (config.js) {
    chrome.on('Page.frameStartedLoading', r => {
      if (r.frameId.endsWith('.1'))
        contextId = null
    })

    chokidar.watch(config.js.watch, config.js.options || { ignoreInitial: true })
    .on('all', (type, file) => {
      Promise.resolve().then(config.js.compile).then(injectJs).catch(log.error)
    })

    Promise.resolve().then(config.js.compile).then(injectJs).catch(log.error)
  } else {
    chrome.send('Page.reload', { ignoreCache: true })
  }

  if (config.css) {
    chrome.on('Page.loadEventFired', () => {
      chrome.on('CSS.styleSheetAdded', function added(style) {
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
    if (config.jail) {
      const start = Date.now()

      source = jail(source)
      log.debug('Jailing took', Date.now() - start + 'ms')
    }

    source = 'if(window.self === window.top){' + source + '}'

    if (!script) {
      chrome.send('Page.addScriptToEvaluateOnLoad', {
        scriptSource: source
      }, (err, result) => {
        if (err)
          return log(err)

        scriptId = result.identifier
        chrome.send('Page.reload', { ignoreCache: true }, () => {
          chrome.on('Debugger.scriptParsed', (s) => {
            if (contextId === null)
              contextId = s.executionContextId

            if (!s.url && !s.isInternalScript && s.executionContextId === contextId && source.split('\n').length - 1 === s.endLine)
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
      log.debug(err, result)
      if (err || !config.run) {
        log(err
          ? 'Failed hot reloading injected script - refreshed instead'
          : 'Refreshing page')
        chrome.send('Page.reload', { ignoreCache: true }, log.debug)
        return
      }

      chrome.send('Runtime.evaluate', { expression: config.run }, log.debug)
      log('Reloaded injected script')
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

function appendStylesheet(source) {
  return `var style = document.createElement('style')
    style.type = 'text/css'
    style.title = 'WrightInjected'
    style.appendChild(document.createTextNode(\`${ source }\`))
    document.head.appendChild(style)
  `
}
