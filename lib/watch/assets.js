const url = require('url')
    , path = require('path')
    , log = require('../log')
    , config = require('../config')
    , watch = require('./watch')
    , utils = require('../utils')
    , chrome = require('../chrome')
    , js = require('./js')
    , css = require('./css')

module.exports = function() {
  chrome.on('Started', fetchResources)
  chrome.on('Page.domContentEventFired', fetchResources)

  chrome.on('Network.responseReceived', data =>
    data.response.status === 404 ? watchResource(data.response.url) : ''
  )
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
      return css.set(style)
    }
  }))
}

function watchResource(src) {
  const ext = path.extname(src)
      , isLocal = src.startsWith(config.url)
      , pathname = src && url.parse(src).pathname
      , localPath = pathname && path.join(config.serve, pathname)

  if (!localPath || !isLocal || !ext || ext === '.css' || ext === '.js')
    return

  watch(localPath, file => {
    file = utils.slash(path.relative(config.serve, file))

    log('Hot reloading', file)

    updateUrlInStyles(file)
    .then(() => updateSrc(file))
    .then(() => js.runAll(file))
    .catch(log.error)
  })
}

function fetchResources() {
  chrome.send('Page.getResourceTree').then(result => {
    result.frameTree.resources
    .filter(r => r.type !== 'Document')
    .forEach(r => watchResource(r.url))
  }).catch(log.error)
}
