'use strict'

const chrome = require('../chrome')
    , path = require('path')
    , log = require('../log')
    , fs = require('fs')

let notificationId = 0

const clientSrc = `
  if(window.self === window.top) {
    window.wright = {};
    ${ fs.readFileSync(path.join(__dirname, 'fonts.js'), { encoding: 'utf8' }) };
    ${ fs.readFileSync(path.join(__dirname, 'warning.js'), { encoding: 'utf8' }) };
    ${ fs.readFileSync(path.join(__dirname, 'error.js'), { encoding: 'utf8' }) };
    ${ fs.readFileSync(path.join(__dirname, 'notification.js'), { encoding: 'utf8' }) }
  }
`

module.exports = function() {
  return chrome.send('Runtime.evaluate', {
    expression: clientSrc
  }).then(() => chrome.send('Page.addScriptToEvaluateOnLoad', {
    scriptSource: clientSrc
  })).then(() => module.exports.error())
}

module.exports.error = function(title, content) {
  const contentString = content && typeof content.stack === 'string'
    ? content.stack
    : JSON.stringify(content, null, 2)

  chrome.send('Runtime.evaluate', {
    expression: `
      wright.error('${ (title || '').replace(/\\/g, '/') }', \`${ String(contentString).replace(/\\/g, '\\\\') }\`)
    `
  })
  .catch(log.error)
}


module.exports.notification = function(title, content) {
  const id = 'wrightnotification' + notificationId++

  chrome.send('Runtime.evaluate', {
    expression: `
      wright.notification('${ id }', '${ (title || '').replace(/\\/g, '/') }', '${ content.replace(/\\/g, '/') }')
    `
  })
  .then(r => r.result.value)
  .catch(log.error)

  return {
    done: () => done(id),
    close: () => close(id)
  }
}

function done(id) {
  chrome.send('Runtime.evaluate', {
    expression: `
      wright.notification.done('${ id }')
    `
  })
  .catch(log.error)
}

function close(id) {
  chrome.send('Runtime.evaluate', {
    expression: `
      wright.notification.close('${ id }')
    `
  })
  .catch(log.error)
}
