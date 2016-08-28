'use strict'

const log = require('../log')
    , utils = require('../utils')
    , config = require('../config')
    , childProcess = require('child_process')

module.exports = function() {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--silent-launch',
    '--user-data-dir=' + config.appData,
    '--remote-debugging-port=' + (config.debugPort)
  ]

  if (config.debug === 2)
    args.push('--enable-logging=stderr')

  if (config.fps)
    args.push('--show-fps-counter')

  const child = childProcess.spawn(utils.chromePath, args, { detached: true })

  if (config.debug === 2)
    child.stderr.on('data', d => log('\x1b[32mChrome:\x1b[0m', d.toString().slice(51)))

}
