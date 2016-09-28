'use strict'

const fs = require('fs')
    , ui = require('../ui')
    , url = require('url')
    , path = require('path')
    , log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , chrome = require('../chrome')
    , utils = require('../utils')
    , js = require('./js')

const styles = new Map()

module.exports = function() {
  chrome.on('CSS.styleSheetAdded', styleSheetParsed)
}

module.exports.styles = styles
module.exports.set = setStyle

function styleSheetParsed(style) {
  style = style.header

  if (style.isInline)
    return

  const pathname = style.sourceURL && url.parse(style.sourceURL).pathname
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
  if (!style.ownerNode)
    return

  fs.readFile(localPath, 'utf8', (err, content) => {
    if (err)
      log.debug('Error reading', path.relative(config.serve, localPath), err)

    style.text = content || ''
    styles.set(localPath, style)
  })

  watch(localPath, file => {
    const notification = ui.notification('Injecting', path.relative(config.serve, file))
        , href = utils.slash(path.relative(config.serve, file))

    chrome.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('link[href*="${ href }"]').forEach(el => {
        el.href = '${href + '?' + Date.now()}'
      })`
    })
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
