const config = require('./config')
    , chrome = require('./chrome')
    , utils = require('./utils')
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
  config.css.forEach((css, i) => {
    utils.promisify(css.compile).then(source => {
      return chrome.send('Runtime.evaluate', {
        expression: `(function(){
          const style = document.createElement('style')
          style.type = 'text/css'
          style.title = '${ css.path }'
          style.appendChild(document.createTextNode(\`${ source }\`))
          document.head.appendChild(style)
        }())`
      }).then(r => {
        if (r.result.subtype === 'error')
          throw r
      })
    }).catch(log.error)
  })
}

function compileJs(js) {
  return utils.promisify(js.compile).then(source => {
    source = jail(utils.wrapInjectedCode(source))

    const lines = source.split('\n')

    js.endLine = lines.length - 1
    js.endColumn = lines[lines.length - 1].length

    return chrome.send('Page.addScriptToEvaluateOnLoad', {
      scriptSource: source
    })
  })
}
