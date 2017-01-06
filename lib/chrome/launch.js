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
    '--disable-translate',
    '--silent-launch',
    '--disable-infobars',
    '--user-data-dir=' + config.appData,
    '--remote-debugging-port=' + (config.debugPort)
  ]

  if (config.debug === 2)
    args.push('--enable-logging=stderr')

  if (config.fps)
    args.push('--show-fps-counter')

  const child = childProcess.spawn(utils.chromePath, args, { detached: process.platform === 'win32' })

  child.on('error', err => {
    if (err.code === 'ENOENT')
      log.error('It seems the path to chrome is wrong.\n\nCheck if chrome exists at: "' + err.path + '"')
    else
      log.error(err)

    process.exit() // eslint-disable-line
  })

  if (config.debug > 1) {
    let lastStdErr = Date.now()

    child.stderr.on('data', d => {
      if (Date.now() - lastStdErr > 10)
        log('\x1b[32mChrome err:\x1b[0m', d.toString())
      else
        log.console.log(d.toString())

      lastStdErr = Date.now()
    })
  }

  if (config.debug > 2) {
    let lastStdOut = Date.now()

    child.stdout.on('data', d => {
      if (Date.now() - lastStdOut > 10)
        log('\x1b[32mChrome out:\x1b[0m', d.toString())
      else
        log.console.log(d.toString())

      lastStdOut = Date.now()
    })
  }

}
