const chokidar = require('chokidar')
    , fs = require('fs')
    , path = require('path')
    , log = require('../log')
    , config = require('../config')

const watching = new Map()

module.exports = function watch(file, changed, glob) {
  if (watching.has(file)) {
    watching.get(file).close()
  } else {
    log.debug('Watching', glob
      ? file
      : path.relative(config.serve, file),
      fs.existsSync(file) || glob ? '' : '\x1b[31m(not found on disk)\x1b[0m'
    )
  }

  function normalizePath(file) {
    require('../serve').ubre.publish('reload')
    const filePath = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file
    log.debug('Changed', filePath)
    changed && changed(filePath)
  }

  watching.set(file, chokidar.watch(file, {
    ignoreInitial: true, useFsEvents: false
  }).on('add', normalizePath).on('change', normalizePath))
}

module.exports.watching = watching
