'use strict'

const log = require('../log')
    , path = require('path')
    , utils = require('../utils')
    , config = require('../config')
    , childProcess = require('child_process')

module.exports = function() {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--silent-launch',
    '--user-data-dir=' + getAppDataDirectory(),
    '--remote-debugging-port=' + (config.debugPort)
  ]

  if (config.debug === 2)
    args.push('--enable-logging=stderr')

  if (config.fps)
    args.push('--show-fps-counter')

  const child = childProcess.spawn(utils.chromePath, args, { detached: true })

  if (config.debug === 2)
    child.stderr.on('data', d => log(d.toString()))

}

function getAppDataDirectory() {
  let root = ''

  if (process.platform === 'darwin')
    root = path.join(process.env.HOME, '/Library/Application Support')
  else if (process.platform === 'win32')
    root = process.env.APPDATA || ''

  return path.join(root || '', 'wright', config.name)
}
