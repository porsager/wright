'use strict'

const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , chokidar = require('chokidar')
    , log = require('./log')
    , utils = require('./utils')
    , config = require('./config')

const watcher = chokidar.watch([], { ignoreInitial: true })
    , watching = new Map()

let resources = []

module.exports = function(chrome) {

  chrome.on('Debugger.scriptParsed', script => {
    const scriptPath = getPath(script.url)

    if (!scriptPath || !script.url.startsWith(config.url))
      return

    watch(scriptPath, file => {
      chrome.send('Debugger.setScriptSource', {
        scriptId: script.scriptId,
        scriptSource: fs.readFileSync(file, 'utf8')
      }, () => {
        chrome.send('Runtime.evaluate', {
          expression: config.run.endsWith('.js') ? fs.readFileSync(config.run, 'utf8') : config.run
        })
      })
    })
  })

  chrome.on('CSS.styleSheetAdded', style => {
    style = style.header
    if (!style.sourceURL || !style.sourceURL.startsWith(config.url))
      return

    const file = getPath(style.sourceURL)

    try {
      style.text = fs.readFileSync(file, 'utf8')
    } catch (e) {
      style.text = ''
    }

    chrome.styles.set(style.styleSheetId, style)

    watch(file, () => {
      style.text = fs.readFileSync(file, 'utf8')
      setStyle(style)
    })
  })

  chrome.on('CSS.styleSheetRemoved', styleSheetId => {
    chrome.styles.delete(styleSheetId)
  })

  function setStyle(style) {
    chrome.send('CSS.setStyleSheetText', {
      styleSheetId: style.styleSheetId,
      text: style.text
    })
  }

  if (path.extname(config.main) === '.html') {
    chokidar.watch(path.join(config.serve, config.main), {
      ignoreInitial: true
    }).on('all', () => {
      chrome.send('Page.reload')
    })
  }

  chrome.on('Page.domContentEventFired', fetchResources)
  chrome.on('Started', fetchResources)

  function fetchResources() {
    chrome.send('Page.getResourceTree', (err, result) => {
      if (err)
        return log(err)

      const newResources = result.frameTree.resources
      .map(r => r.url)
      .filter(u => u.startsWith(config.url))
      .filter(assets)
      .map(getPath)

      watcher.add(newResources.filter(r => resources.indexOf(r) < 0))
      watcher.unwatch(resources.filter(r => newResources.indexOf(r) < 0))

      resources = newResources
    })
  }

  watcher.on('all', (event, file) => {
    file = utils.slash(path.relative(config.serve, file))

    log.debug('Reloading', file)

    chrome.send('Runtime.evaluate', { expression: images(file) })
    chrome.styles.forEach(style => {
      const string = style.text.split(file).join(file.split('?')[0] + '?' + Date.now())

      if (string !== style.text) {
        style.text = string
        setStyle(style)
      }
    })
  })

  return chrome
}

function assets(p) {
  const ext = path.extname(p)

  return ext && ext !== '.js' && ext !== '.css' && ext !== '.html'
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

function images(filename) {
  return `
    document.querySelectorAll('img[src*="${filename}"]')
    .forEach(img => img.src = '${filename + '?' + Date.now()}')
  `
}
