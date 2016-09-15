'use strict'

const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , log = require('./log')
    , jail = require('./jail')
    , utils = require('./utils')
    , config = require('./config')
    , chokidar = require('chokidar')

const watcher = chokidar.watch([], { ignoreInitial: true })
    , watching = new Map()

let resources = []

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
        .then(code => inject(parsedScript, code))
        .catch(log.error)
      })
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

          inject(parsedScript, content)
        })
      }, 50)
    })

  })

  chrome.on('CSS.styleSheetAdded', style => {
    style = style.header

    if (style.isInline)
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
          })
        }).catch(log.error)
      })
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
          setStyle(style)
        })
      }, 50)
    })
  })

  chrome.on('CSS.styleSheetRemoved', styleSheetId => {
    chrome.styles.delete(styleSheetId)
  })

  if (path.extname(config.main) === '.html') {
    chokidar.watch(path.join(config.serve, config.main), {
      ignoreInitial: true
    }).on('all', () => {
      log(config.main, 'changed - Refreshing')
      chrome.send('Page.reload', { ignoreCache: true })
    })
  }

  if (config.watch) {
    chokidar.watch(config.watch, {
      ignoreInitial: true
    }).on('all', (event, file) => {
      log(file, 'changed - Refreshing')
      chrome.send('Page.reload', { ignoreCache: true })
    })
  }

  chrome.on('Page.domContentEventFired', fetchResources)
  chrome.on('Started', fetchResources)

  watcher.on('all', (event, file) => {
    file = utils.slash(path.relative(config.serve, file))

    log('Hot reloading', file)

    chrome.send('Runtime.evaluate', { expression: updateSrc(file) })
    chrome.styles.forEach(style => {
      const string = style.text.split(file).join(file.split('?')[0] + '?' + Date.now())

      if (string !== style.text) {
        style.text = string
        setStyle(style)
      }
    })
  })

  function inject(parsedScript, content) {
    chrome.send('Debugger.setScriptSource', {
      scriptId: parsedScript.scriptId,
      scriptSource: config.external ? content : jail(content)
    }).then(run)
  }

  function fetchResources() {
    chrome.send('Page.getResourceTree').then(result => {
      config.frameId = result.frameTree.frame.id

      const newResources = result.frameTree.resources
      .map(r => r.url)
      .filter(u => u.startsWith(config.url) && path.extname(u))
      .map(getPath)
      .filter(f => fs.existsSync(f))

      watcher.add(newResources.filter(r => resources.indexOf(r) < 0))
      watcher.unwatch(resources.filter(r => newResources.indexOf(r) < 0))

      resources = newResources
    }).catch(log.error)
  }

  function setStyle(style) {
    chrome.send('CSS.setStyleSheetText', {
      styleSheetId: style.styleSheetId,
      text: style.text
    })
  }

  function run() {
    if (!config.run)
      return chrome.send('Page.reload', { ignoreCache: true }, log.debug)

    chrome.send('Runtime.evaluate', { expression: config.run })
    .then(data => {
      if (data.result.className === 'ReferenceError')
        throw new Error(data.exceptionDetails.text)
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

function watch(file, change) {
  if (watching.has(file))
    watching.get(file).close()
  else
    log.debug('Watching', path.relative(config.serve, file))

  watching.set(file, chokidar.watch(file, {
    ignoreInitial: true
  }).on('all', (type, file) => change(file)))
}

function updateSrc(filename) {
  return `
    document.querySelectorAll('img,audio,video').forEach(el => {
      if (el.src)
        el.src = '${filename + '?' + Date.now()}'
    })
  `
}
