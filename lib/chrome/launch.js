const log = require('../log')
    , path = require('path')
    , utils = require('../utils')
    , config = require('../config')
    , childProcess = require('child_process')

const appDataDirs = {
  darwin: path.join(process.env.HOME, '/Library/Application Support'),
  win32: process.env.APPDATA || ''
}

module.exports = function() {
  const appDataDir = path.join(appDataDirs[process.platform] || '', 'wright', config.name)

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--silent-launch',
    '--user-data-dir=' + appDataDir,
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
