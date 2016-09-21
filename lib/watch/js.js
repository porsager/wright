const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , log = require('../log')
    , ui = require('../ui')
    , sessions = require('../sessions')
    , config = require('../config')
    , watch = require('./watch')
    , jail = require('../jail')
    , chrome = require('../chrome')

let scripts = []

module.exports = function() {
  chrome.on('Debugger.scriptParsed', scriptParsed)
  scripts = sessions.get('scripts') || []
  scripts.forEach(scriptParsed)
}

module.exports.runAll = function(filename) {
  if (config.runAll)
    return run(filename)
}

function scriptParsed(script) {
  const pathname = script.url && url.parse(script.url).pathname
      , localPath = pathname && path.join(config.serve, pathname)
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
    const notification = ui.notification('Injecting', path.relative(config.serve, file))

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      fs.readFile(file, 'utf8', (err, content) => {
        if (err)
          return log.error('Error reading', path.relative(config.serve, file), err)

        inject(script, content, file)
        .then(notification.done)
        .catch(err => {
          log.error(err)
          notification.close()
        })

      })
    }, config.jsDelay)
  })
}

function handleInjectedScript(script, js) {
  watch(js.watch, (file) => {
    const notification = ui.notification('Injecting', file)

    js.compile()
    .then(code => inject(script, code, file))
    .then(() => {
      ui.error()
      notification.done()
    })
    .catch(err => {
      log.error('Injecting', file, err)
      ui.error('Injection failed for ' + file, err)
      notification.close()
    })
  }, true)
}


function inject(script, content, file) {
  log.debug('Injecting', file)
  save(script)
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

function save(script) {
  if (scripts.some(s => s.scriptId === script.scriptId))
    return

  scripts.push(script)
  sessions.set('scripts', scripts)
}

function run(filename) {
  if (!config.run && !config.runAll)
    return refresh(filename)

  chrome.send('Runtime.evaluate', {
    expression: `(function(filename){ ${ config.run || config.runAll } })('${ filename }');`
  }).then(data => {
    if (data.result.subtype === 'error')
      throw data.exceptionDetails
    else
      ui.error()
  }).catch(error => {
    log.error('Error injecting', filename, error)
    ui.error('Error injecting', filename, error)
  })
}

function refresh(file) {
  log(file, 'changed - Refreshing')
  return chrome.send('Page.reload', { ignoreCache: true }).catch(log.error)
}
