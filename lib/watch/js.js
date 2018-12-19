'use strict'

const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , log = require('../log')
    , utils = require('../utils')
    , session = require('../session')
    , config = require('../config')
    , watch = require('./watch')
    , jail = require('../jail')
    , chrome = require('../chrome')

let scripts = []

const srcCache = {}

module.exports = function() {
  chrome.on('Debugger.scriptParsed', scriptParsed)
  scripts = session.get('scripts') || []
  scripts.forEach(scriptParsed)
}

module.exports.run = run

function scriptParsed(script) {
  if (!script.url || !script.url.startsWith(config.url) || scripts.url)
    return

  const pathname = script.url && decodeURIComponent(url.parse(script.url).pathname)
      , localPath = pathname && path.join(config.serve, pathname)
      , js = config.js.find(s => pathname === s.path || pathname === '/' + s.path)

  if ((!js && path.extname(localPath) !== '.js') || pathname === '/wright.js')
    return

  script.path = pathname

  watch(js ? js.watch : localPath, file => {
    if (!config.run)
      return refresh(file)

    utils.promisify(js
      ? js.compile
      : fn => fs.readFile(file, 'utf8', fn)
    )
    .then(code => inject(script, code, file))
    .catch(err => {
      log.error(err)
    })
  }, js)
}

function inject(script, content, file) {
  log.debug(file, 'changed, compiling...')
  const src = content.code || content
  if (srcCache[script.scriptId] === src)
    return refresh(file)

  save(script)
  srcCache[script.scriptId] = src
  return chrome.send('Debugger.setScriptSource', {
    scriptId: script.scriptId,
    scriptSource: jail(src)
  }).then(result => {
    if (result.callFrames && result.callFrames.length === 0 && result.stackChanged === false)
      log.debug('Injected', script.path)
    else
      log.error('Error injecting', file, result)

    return run(file)
  })
}

function save(script) {
  if (scripts.some(s => s.scriptId === script.scriptId))
    return

  scripts.push(script)
  session.set('scripts', scripts)
}

function run(filename) {
  if (!config.run || config.run === true)
    return

  require('../serve').ubre.publish('run', { method: config.run, arg: { path: filename } })
}

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true }).catch(log.error)
}
