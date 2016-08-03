const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , chokidar = require('chokidar')
    , utils = require('./utils')
    , config = require('./config')

const scripts = new Map()
    , graphicExt = new Set(['.jpg', '.png', '.gif', '.webm', '.svg'])
    , fontExt = new Set(['.woff', '.ttf'])

module.exports = function(chrome) {

  chokidar.watch(config.serve, {
    ignoreInitial: true
  }).on('all', (event, file) => reload(file))

  config.scripts.map(script => {
    if (config.debug)
      log('Found script ', script)

    if (!script.path) {
      config.script = config.script || script
      return
    }

    if (!scripts.has(script.path))
      watchScript(script)

    scripts.set(script.path, script)
  })

  function reload(file) {
    if (config.debug)
      log('Reloading', file)

    file = utils.slash(path.relative(config.serve || config.watch, file))

    const ext = path.extname(file)

    if (ext === '.html')
      chrome.refresh()
    else if (ext === '.css')
      chrome.run(css(file))
    else if (graphicExt.has(ext))
      chrome.run(images(file))
    else if (fontExt.has(ext))
      chrome.run(fonts(file))
  }

  return chrome
}

function watchScript(script) {
  log('Watching script: ' + path.relative(config.watch, script.path))
  chokidar.watch(script.path, { ignoreInitial: true }).on('change', scriptChanged)
}

function scriptChanged(path) {
  const script = scripts.get(path)

  if (config.run)
    config.api.inject(script, fs.readFileSync(script.path, 'utf8'))
  else
    config.api.refresh()
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
