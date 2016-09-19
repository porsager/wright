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
    log.debug('Watching', glob ? file : path.relative(config.serve, file),
              fs.existsSync(file) || glob ? '' : '\x1b[31m(404)\x1b[0m')
  }

  watching.set(file, chokidar.watch(file, {
    ignoreInitial: true
  }).on('add', changed).on('change', changed))
}

module.exports.watching = watching
