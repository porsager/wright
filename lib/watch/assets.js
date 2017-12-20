'use strict'

const js = require('./js')
    , css = require('./css')
    , path = require('path')
    , log = require('../log')
    , watch = require('./watch')
    , serve = require('../serve')
    , chrome = require('../chrome')
    , config = require('../config')
    , session = require('../session')

let assets = new Set()

module.exports = function() {
  serve.on('get', localPath => {
    const ext = path.extname(localPath)

    if ((ext === '.js' || ext === '.css') && watch.watching.has(localPath))
      return

    if (localPath.endsWith('/') && !ext)
      localPath += 'index.html'

    watchAsset(localPath)
    assets.add(localPath)
    session.set('assets', Array.from(assets))
  })
  assets = new Set(session.get('assets') || [])
  assets.forEach(watchAsset)
}

module.exports.watchAsset = watchAsset

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true })
}

function watchAsset(localPath) {
  watch(localPath, file => {
    if (file.endsWith('.html'))
      return refresh(file)

    log.debug('Reloading', file)

    updateUrlInStyles(path.join(process.cwd(), file))
    .then(() => updateSrc(file))
    .then(() => js.run(file))
    .catch(log.error)
  })
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
  file = path.relative(config.serve, path.join(process.cwd(), file))
  const src = '[src*="' + file + '"]'

  if (path.extname(file) === '.svg') {
    chrome.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('use[href*="${ file }"]').forEach(el => {
        el.setAttribute('href', el.getAttribute('href').replace(/${file}/i, '${file}&wright=' + Date.now()))
      })`
    })
  }

  return chrome.send('Runtime.evaluate', {
    expression: `document.querySelectorAll('img${ src },audio${ src },video${ src }').forEach(el => {
      el.src = '${file + '?' + Date.now()}'
    })`
  })
}
