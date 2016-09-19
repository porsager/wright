const fs = require('fs')
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

  watch(localPath, () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      fs.readFile(localPath, 'utf8', (err, content) => {
        if (err)
          return log.error('Error reading .css', err)

        style.text = content
        setStyle(style).then(() => js.runAll(localPath))
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
      }).then(() => js.runAll(file))
    }).catch(log.error)
  }, true)
}

function setStyle(style) {
  return chrome.send('CSS.setStyleSheetText', {
    styleSheetId: style.styleSheetId,
    text: style.text
  })
}
