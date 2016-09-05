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
    const scriptPath = parsedScript.url && getPath(parsedScript.url)

    if (!scriptPath || !parsedScript.url.startsWith(config.url))
      return

    const script = config.js.find(s => scriptPath.endsWith(s.path))

    if (script) {
      chokidar.watch(script.watch, script.options || { ignoreInitial: true })
      .on('all', (type, file) => {
        Promise.resolve().then(script.compile).then(code => inject(parsedScript, code)).catch(log.error)
      })
      return
    }

    let debounceTimer

    watch(path.join(config.serve, scriptPath), file => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(file, 'utf8', (err, content) => {
          if (err)
            return log.error('Error reading', scriptPath, err)

          inject(parsedScript, content)
        })
      }, 50)
    })

    function inject(parsedScript, content) {
      chrome.send('Debugger.setScriptSource', {
        scriptId: parsedScript.scriptId,
        scriptSource: jail(content)
      }, (err, data) => {
        log.debug(err)
        if (config.run) {
          log('Hot reloaded', scriptPath)
          chrome.send('Runtime.evaluate', {
            expression: config.run
          }, (err, data) => {
            log.debug(err)
            if (data.result.className === 'ReferenceError') {
              log.error(data.exceptionDetails.text, '- Refreshing')
              chrome.send('Page.reload', { ignoreCache: true }, log.debug)
            }
          })
        } else {
          log(script.path, 'changed - Refreshing')
          chrome.send('Page.reload', { ignoreCache: true }, log.debug)
        }
      })
    }
  })

  chrome.on('CSS.styleSheetAdded', style => {
    style = style.header
    if (style.isInline || !style.sourceURL || !style.sourceURL.startsWith(config.url))
      return

    const file = getPath(style.sourceURL)

    const sheet = config.css.find(s => file.endsWith(s.path))

    if (sheet) {
      chokidar.watch(sheet.watch, sheet.options || { ignoreInitial: true })
      .on('all', (type, file) => {
        Promise.resolve().then(sheet.compile).then(source => {
          chrome.send('CSS.setStyleSheetText', {
            styleSheetId: style.styleSheetId,
            text: source
          }, (err, result) => {
            if (err)
              return log(err)

            log('Reloaded injected style', sheet.path)
            log.debug(err)
          })
        }).catch(log.error)
      })
      return
    }

    fs.readFile(path.join(config.serve, file), 'utf8', (err, content) => {
      if (err)
        log.debug('Error reading', file, err)

      style.text = content || ''
      chrome.styles.set(style.styleSheetId, style)
    })

    let debounceTimer

    watch(path.join(config.serve, file), () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(path.join(config.serve, file), 'utf8', (err, content) => {
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

    log('Hot reloading', file)

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
  return p && url.parse(p).pathname
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
