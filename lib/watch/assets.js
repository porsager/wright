const url = require('url')
    , path = require('path')
    , log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , utils = require('../utils')
    , chrome = require('../chrome')
    , ui = require('../ui')
    , js = require('./js')
    , css = require('./css')

module.exports = function() {
  chrome.on('Started', fetchResources)
  chrome.on('Page.domContentEventFired', fetchResources)

  chrome.on('Network.responseReceived', data =>
    data.response.status === 404 ? watchResource(data.response.url) : ''
  )
}

function watchResource(src) {
  const ext = path.extname(src)
      , isLocal = src.startsWith(config.url)
      , pathname = src && url.parse(src).pathname
      , localPath = pathname && path.join(config.serve, pathname)
      , parsedSheet = config.css.some(s => s.path === pathname)
                   || Array.from(css.styles.values()).some(s => s.path === localPath)

  if (!localPath || !isLocal || !ext || ext === '.js' || parsedSheet)
    return

  watch(localPath, absolutePath => {
    const file = utils.slash(path.relative(config.serve, absolutePath))

    log.debug('Reloading', file)
    const notification = ui.notification('Reloading', file)

    updateUrlInStyles(absolutePath)
    .then(() => updateSrc(file))
    .then(() => js.runAll(file))
    .then(() => {
      notification.done()
    })
    .catch(err => {
      notification.close()
      ui.error('Error reloading ' + file, err)
      log.error(err)
    })
  })
}

function fetchResources() {
  chrome.send('Page.getResourceTree').then(result => {
    result.frameTree.resources
    .filter(r => r.type !== 'Document')
    .forEach(r => watchResource(r.url))
  }).catch(log.error)
}

function updateUrlInStyles(file) {
  return Promise.all(Array.from(css.styles.values()).map(style => {
    file = path.relative(path.dirname(style.path), file)

    const string = style.text.split(new RegExp(file + '(?:\\?[0-9]*)?', 'gi')).join(file + '?' + Date.now())

    if (string !== style.text) {
      style.text = string
      return css.set(style)
    }
  }))
}

function updateSrc(file) {
  const src = '[src*="' + file + '"]'

  return chrome.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('img${ src },audio${ src },video${ src }').forEach(el => {
      el.src = '${file + '?' + Date.now()}'
    })`
  })
}
