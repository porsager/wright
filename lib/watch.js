'use strict'

const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , log = require('./log')
    , jail = require('./jail')
    , utils = require('./utils')
    , config = require('./config')
    , chokidar = require('chokidar')

const watching = new Map()

module.exports = function(chrome) {

  chrome.on('Debugger.scriptParsed', parsedScript => {
    const scriptPath = parsedScript.url && parsedScript.url.endsWith('.js') && getPath(parsedScript.url)

    const script = config.js.find(s => {
      return (scriptPath && scriptPath.endsWith(s.path)) ||
             (s.endLine === parsedScript.endLine && s.endColumn === parsedScript.endColumn)
    })

    if (script) {
      return watch(script.watch, file => {
        Promise.resolve()
        .then(script.compile)
        .then(code => inject(parsedScript, code, file))
        .catch(log.error)
      }, true)
    }

    if (!fs.existsSync(scriptPath))
      return

    let debounceTimer

    watch(scriptPath, file => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(file, 'utf8', (err, content) => {
          if (err)
            return log.error('Error reading', path.relative(config.serve, scriptPath), err)

          inject(parsedScript, content, scriptPath).catch(log.error)
        })
      }, 50)
    })

  })

  chrome.on('CSS.styleSheetAdded', style => {
    style = style.header

    if (style.isInline || !style.sourceURL.startsWith(config.url))
      return

    const sheetPath = getPath(style.sourceURL)

    const sheet = config.css.find(s => {
      return (sheetPath && sheetPath.endsWith(s.path)) ||
             (s.path === style.title)
    })

    if (sheet) {
      return watch(sheet.watch, file => {
        Promise.resolve().then(sheet.compile).then(source => {
          return chrome.send('CSS.setStyleSheetText', {
            styleSheetId: style.styleSheetId,
            text: source
          }).then(result => {
            log('Reloaded injected style', sheet.path)
            log.debug(result)
          }).then(() => runAll(file))
        }).catch(log.error)
      }, true)
    }

    if (!fs.existsSync(sheetPath))
      return log.debug('Could not find', path.relative(config.serve, sheetPath))

    fs.readFile(sheetPath, 'utf8', (err, content) => {
      if (err)
        log.debug('Error reading', path.relative(config.serve, sheetPath), err)

      style.text = content || ''
      chrome.styles.set(style.styleSheetId, style)
    })

    if (!fs.existsSync(sheetPath))
      return

    let debounceTimer

    watch(sheetPath, () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(sheetPath, 'utf8', (err, content) => {
          if (err)
            return log.error('Error reading .css', err)

          style.text = content
          setStyle(style).then(() => runAll(sheetPath))
        })
      }, 50)
    })
  })

  chrome.on('CSS.styleSheetRemoved', styleSheetId => {
    chrome.styles.delete(styleSheetId)
  })

  if (path.extname(config.main) === '.html')
    watch(config.main, refresh)

  if (config.watch)
    watch(config.watch, refresh, true)

  chrome.on('Page.domContentEventFired', fetchResources)
  chrome.on('Started', fetchResources)

  function refresh(file) {
    log(file, 'changed - Refreshing')
    chrome.send('Page.reload', { ignoreCache: true })
  }

  function reload(file) {
    file = utils.slash(path.relative(config.serve, file))

    log('Hot reloading', file)

    chrome.send('Runtime.evaluate', { expression: updateSrc(file) })
    .then(() => Promise.all(Array.from(chrome.styles.values()).map(style => {
      const string = style.text.split(file).join(file.split('?')[0] + '?' + Date.now())

      if (string !== style.text) {
        style.text = string
        return setStyle(style)
      }
    })))
    .then(() => runAll(file))
    .catch(log.error)
  }

  chrome.on('Network.responseReceived', data => {
    if (data.response.status === 404)
      watchResource(data.response.url)
  })

  function inject(parsedScript, content, file) {
    return chrome.send('Debugger.setScriptSource', {
      scriptId: parsedScript.scriptId,
      scriptSource: config.external && parsedScript.url ? content : jail(content)
    }).then(() => run(file))
  }

  function fetchResources() {
    chrome.send('Page.getResourceTree').then(result => {
      result.frameTree.resources
      .filter(r => r.type !== 'Document')
      .forEach(r => watchResource(r.url))
    }).catch(log.error)
  }

  function watchResource(url) {
    const ext = path.extname(url)
        , isLocal = url.startsWith(config.url)
        , filePath = getPath(url)

    if (isLocal && ext && ext !== '.css' && ext !== '.js')
      watch(filePath, reload)
  }

  function setStyle(style) {
    chrome.send('CSS.setStyleSheetText', {
      styleSheetId: style.styleSheetId,
      text: style.text
    })
  }

  function runAll(filename) {
    if (config.runAll)
      run(filename)
  }

  function run(filename) {
    if (!config.run && !config.runAll)
      return chrome.send('Page.reload', { ignoreCache: true }, log.debug)

    chrome.send('Runtime.evaluate', {
      expression: `(function(filename){
        ${ config.run || config.runAll }
      })('${ filename }');`
    }).then(data => {
      if (data.result.subtype === 'error')
        throw data.exceptionDetails
    }).catch(error => {
      log.error(error, '- Refreshing')
      chrome.send('Page.reload', { ignoreCache: true }, log.debug)
    })
  }

  return chrome
}

function getPath(p) {
  return p && path.join(config.serve, url.parse(p).pathname)
}

function watch(file, changed, glob) {
  if (watching.has(file))
    watching.get(file).close()
  else
    log.debug('Watching', glob ? file : path.relative(config.serve, file), fs.existsSync(file) || glob ? '' : '\x1b[31m(404)\x1b[0m')

  watching.set(file, chokidar.watch(file, {
    ignoreInitial: true
  }).on('add', changed).on('change', changed))
}

function updateSrc(filename) {
  return `
    document.querySelectorAll('img,audio,video').forEach(el => {
      if (el.src)
        el.src = '${filename + '?' + Date.now()}'
    })
  `
}
