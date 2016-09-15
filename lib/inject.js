const config = require('./config')
    , jail = require('./jail')
    , log = require('./log')

module.exports = function(chrome) {
  if (!config.external)
    return chrome

  Promise.all(config.js.map(js => {
    return js.compile().then(source => {
      source = jail(source)

      const lines = source.split('\n')

      js.endLine = lines.length - 1
      js.endColumn = lines[lines.length - 1].length

      return chrome.send('Page.addScriptToEvaluateOnLoad', {
        scriptSource: source
      })
    })
  }))
  .then(result => chrome.send('Page.reload'))
  .catch(log.error)

  chrome.on('Page.domContentEventFired', data => {
    config.css.forEach((sheet, i) => {

      sheet.compile().then(source => {
        chrome.send('Runtime.evaluate', {
          expression: `const style = document.createElement('style')
                       style.type = 'text/css'
                       style.title = '${ sheet.path }'
                       style.appendChild(document.createTextNode(\`${ source }\`))
                       document.head.appendChild(style)`
        }).then(r => r.result.subtype === 'error' && log.error(r))
        .catch(log.error)
      })
    })
  })

  return chrome
}
