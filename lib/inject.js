const config = require('./config')
    , chrome = require('./chrome')
    , jail = require('./jail')
    , log = require('./log')

module.exports = function() {
  if (!config.external)
    return

  chrome.on('Page.loadEventFired', compileCss)

  return Promise.all(config.js.map(compileJs))
  .then(() => chrome.send('Page.reload'))
}

function compileCss() {
  config.css.forEach((sheet, i) =>
    sheet.compile().then(source => {
      return chrome.send('Runtime.evaluate', {
        expression: `const style = document.createElement('style')
                     style.type = 'text/css'
                     style.title = '${ sheet.path }'
                     style.appendChild(document.createTextNode(\`${ source }\`))
                     document.head.appendChild(style)`
      }).then(r => {
        if (r.result.subtype === 'error')
          throw r
      })
    }).catch(log.error)
  )
}

function compileJs(js) {
  return js.compile().then(source => {
    source = `if(window.self === window.top) { ${ jail(source) } }`

    const lines = source.split('\n')

    js.endLine = lines.length - 1
    js.endColumn = lines[lines.length - 1].length

    return chrome.send('Page.addScriptToEvaluateOnLoad', {
      scriptSource: source
    })
  })
}
