const log = require('./log')
    , path = require('path')
    , utils = require('./utils')
    , config = require('./config')

const graphicExt = new Set(['.jpg', '.png', '.gif', '.webm', '.svg'])
    , fontExt = new Set(['.woff', '.ttf'])

module.exports = function(chrome) {
  config.api = {
    chrome: chrome,
    refresh: chrome.refresh,
    inject: (script, scriptSource) => {
      if (!scriptSource && !config.script)
        return chrome.insert(script)

      if (!scriptSource) {
        scriptSource = script
        script = config.script
      }

      chrome.replace(script, scriptSource, (err, result) => {
        const scriptPath = script.path ? path.relative(config.cwd, script.path) : 'injected script'

        if (err) {
          chrome.refresh()
          log('Failed hot reloading ' + scriptPath + ' refreshed instead')
        } else {
          chrome.run(config.reload)
          log('Hot reloaded ' + scriptPath)
        }
      })
    },
    reload: (file) => {
      file = utils.slash(path.relative(config.serve, file))

      const ext = path.extname(file)

      log('change', file)
      if (ext === '.html')
        chrome.refresh()
      else if (ext === '.css')
        chrome.run(css(file))
      else if (graphicExt.has(ext))
        chrome.run(images(file))
      else if (fontExt.has(ext))
        chrome.run(fonts(file))
    }
  }
}

function images(filename) {
  return `
    document.querySelectorAll('img[src*="${filename}"]')
    .forEach(img => img.src = '${filename + '?' + Date.now()}')
  `
}

function css(filename) {
  return `
    var link = document.querySelector('link[href*="${filename}"]')
    if (link) link.href = '${filename + '?' + Date.now()}'
  `
}

// TODO make font reload (change css file with random characters after font-face urls)
function fonts(filename) {
  return `

  `
}
