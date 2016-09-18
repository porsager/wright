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

  if (path.extname(config.main) === '.html')
    watch(config.main, refresh)

  if (config.watch)
    watch(config.watch, refresh, true)

  chrome.on('Started', fetchResources)
  chrome.on('Page.domContentEventFired', fetchResources)
  chrome.on('Debugger.scriptParsed', scriptParsed)
  chrome.on('CSS.styleSheetAdded', styleSheetParsed)
  chrome.on('CSS.styleSheetRemoved', styleSheetId => chrome.styles.delete(styleSheetId))

  chrome.on('Network.responseReceived', data =>
    data.response.status === 404 ? watchResource(data.response.url) : ''
  )

  function styleSheetParsed(style) {
    style = style.header

    if (style.isInline || !style.sourceURL.startsWith(config.url))
      return

    const localPath = path.join(url.parse(style.sourceURL).pathname)
        , css = config.css.find(s =>
            (localPath && localPath.endsWith(s.path)) || (s.path === style.title)
          )

    if (css)
      handleInjectedCss(style, css)
    else if (fs.existsSync(localPath))
      handleFileCss(style, localPath)
  }

  function scriptParsed(script) {
    const pathname = url.parse(script.url).pathname
        , localPath = path.join(config.serve, pathname)
        , js = config.js.find(s =>
          (pathname === s.path) || (s.endLine === script.endLine && s.endColumn === script.endColumn)
        )

    if (js)
      handleInjectedScript(script, js)
    else if (fs.existsSync(localPath))
      handleFileScript(script, localPath)
  }

  function handleFileScript(script, localPath) {
    let debounceTimer

    watch(localPath, file => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(file, 'utf8', (err, content) => {
          if (err)
            return log.error('Error reading', path.relative(config.serve, file), err)

          inject(script, content, file)
        })
      }, config.jsDelay)
    })
  }

  function handleInjectedScript(script, js) {
    watch(js.watch, (file) => {
      js.compile(code => {
        inject(script, code, file)
      })
      .then(code => inject(script, code, file))
      .catch(err => {
        log.error('Injecting', file, err)
      })
    }, true)
  }

  function handleFileCss(style, localPath) {
    fs.readFile(localPath, 'utf8', (err, content) => {
      if (err)
        log.debug('Error reading', path.relative(config.serve, localPath), err)

      style.text = content || ''
      chrome.styles.set(style.styleSheetId, style)
    })

    if (!fs.existsSync(localPath))
      return

    let debounceTimer

    watch(localPath, () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fs.readFile(localPath, 'utf8', (err, content) => {
          if (err)
            return log.error('Error reading .css', err)

          style.text = content
          setStyle(style).then(() => runAll(localPath))
        })
      }, config.cssDelay)
    })
  }

  function handleInjectedCss(style, css) {
    watch(css.watch, file => {
      Promise.resolve().then(css.compile).then(source => {
        return chrome.send('CSS.setStyleSheetText', {
          styleSheetId: style.styleSheetId,
          text: source
        }).then(result => {
          log('Reloaded injected style', css.path)
          log.debug(result)
        }).then(() => runAll(file))
      }).catch(log.error)
    }, true)
  }

  function refresh(file) {
    log(file, 'changed - Refreshing')
    return chrome.send('Page.reload', { ignoreCache: true })
  }

  function updateSrc(file) {
    return chrome.send('Runtime.evaluate', {
      expression: `$$('img,audio,video').forEach(el => {
        if (el.src)
          el.src = '${file + '?' + Date.now()}'
      })`
    })
  }

  function updateUrlInStyles(file) {
    return Promise.all(Array.from(chrome.styles.values()).map(style => {
      const string = style.text.split(file).join(file.split('?')[0] + '?' + Date.now())

      if (string !== style.text) {
        style.text = string
        return setStyle(style)
      }
    }))
  }

  function inject(script, content, file) {
    log.debug('Injecting', file)
    return chrome.send('Debugger.setScriptSource', {
      scriptId: script.scriptId,
      scriptSource: config.external && script.url ? content : jail(content)
    }).then(result => {
      if (result.callFrames && result.callFrames.length === 0 && result.stackChanged === false)
        log.debug('Injected', file)
      else
        log.error('Error injecting', file, result)

      return run(file)
    })
  }

  function fetchResources() {
    chrome.send('Page.getResourceTree').then(result => {
      result.frameTree.resources
      .filter(r => r.type !== 'Document')
      .forEach(r => watchResource(r.url))
    }).catch(log.error)
  }

  function watchResource(src) {
    const ext = path.extname(url)
        , isLocal = url.startsWith(config.url)
        , filePath = path.join(config.serve, url.parse(src).pathname)

    if (!isLocal || !ext || ext === '.css' || ext === '.js')
      return

    watch(filePath, file => {
      file = utils.slash(path.relative(config.serve, file))

      log('Hot reloading', file)

      updateUrlInStyles(file)
      .then(() => updateSrc(file))
      .then(() => runAll(file))
      .catch(log.error)
    })
  }

  function setStyle(style) {
    return chrome.send('CSS.setStyleSheetText', {
      styleSheetId: style.styleSheetId,
      text: style.text
    })
  }

  function runAll(filename) {
    if (config.runAll)
      return run(filename)
  }

  function run(filename) {
    if (!config.run && !config.runAll)
      return refresh().catch(log.debug)

    chrome.send('Runtime.evaluate', {
      expression: `(function(filename){ ${ config.run || config.runAll } })('${ filename }');`
    }).then(data => {
      if (data.result.subtype === 'error')
        throw data.exceptionDetails
    }).catch(error => {
      log.error(error, '- Refreshing')
      refresh().catch(log.debug)
    })
  }

  return chrome
}

function watch(file, changed, glob) {
  if (watching.has(file)) {
    watching.get(file).close()
  } else {
    log.debug('Watching', glob ? file : path.relative(config.serve, file),
              fs.existsSync(file) || glob ? '' : '\x1b[31m(404)\x1b[0m')
  }

  watching.set(file, chokidar.watch(file, {
    ignoreInitial: true
  }).on('add', changed).on('change', changed))
}
