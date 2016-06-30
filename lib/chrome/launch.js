const os = require('os')
    , log = require('../log')
    , path = require('path')
    , utils = require('../utils')
    , config = require('../config')
    , childProcess = require('child_process')

module.exports = function() {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--no-startup-window',
    '--user-data-dir=' + path.join(os.tmpdir(), '.chrome.wright-' + path.basename(config.cwd)),
    '--remote-debugging-port=' + (config.debugPort)
  ]

  if (config.verbose)
    args.push('--enable-logging=stderr')

  if (config.fps)
    args.push('--show-fps-counter')

  const child = childProcess.spawn(utils.chromePath, args, { detached: true })

  if (config.verbose)
    child.stderr.on('data', d => log(d.toString()))
}
