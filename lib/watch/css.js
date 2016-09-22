'use strict'

const fs = require('fs')
    , ui = require('../ui')
    , url = require('url')
    , path = require('path')
    , log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , chrome = require('../chrome')
    , js = require('./js')

module.exports = function() {
  chrome.on('CSS.styleSheetAdded', styleSheetParsed)
  chrome.on('CSS.styleSheetRemoved', styleSheetId => chrome.styles.delete(styleSheetId))
}

module.exports.set = setStyle

function styleSheetParsed(style) {
  style = style.header

  if (style.isInline || !style.sourceURL || !style.sourceURL.startsWith(config.url))
    return

  const pathname = url.parse(style.sourceURL).pathname
      , localPath = pathname && path.join(config.serve, pathname)
      , css = config.css.find(s =>
          (localPath && localPath.endsWith(s.path)) || (s.path === style.title)
        )

  if (css)
    handleInjectedCss(style, css)
  else if (fs.existsSync(localPath))
    handleFileCss(style, localPath)
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

  watch(localPath, file => {
    const notification = ui.notification('Injecting', path.relative(config.serve, file))

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      fs.readFile(localPath, 'utf8', (err, content) => {
        if (err)
          return log.error('Error reading .css', err)

        style.text = content
        setStyle(style)
        .then(() => js.runAll(localPath))
        .then(() => {
          ui.error()
          notification.done()
        })
        .catch(err => {
          ui.error('Injection failed for ' + file, err)
          notification.close()
          log.error(err)
        })
      })
    }, config.cssDelay)
  })
}

function handleInjectedCss(style, css) {
  watch(css.watch, file => {
    const notification = ui.notification('Injecting', file)

    log.debug('Injecting style', css.path)

    Promise.resolve().then(css.compile).then(source => {
      return chrome.send('CSS.setStyleSheetText', {
        styleSheetId: style.styleSheetId,
        text: source
      }).then(result => {
        log.debug('Injected style', css.path)
        notification.done()
      }).then(() => js.runAll(file))
    })
    .then(() => {
      ui.error()
    })
    .catch(err => {
      ui.error('Injection failed for ' + file, err)
      notification.close()
      log.error(err)
    })
  }, true)
}

function setStyle(style) {
  return chrome.send('CSS.setStyleSheetText', {
    styleSheetId: style.styleSheetId,
    text: style.text
  })
}
