const os = require('os')
    , path = require('path')
    , utils = require('../utils')
    , config = require('../config')
    , childProcess = require('child_process')

module.exports = function() {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-web-security',
    '--new-window',
    '--no-startup-window',
    '--user-data-dir=' + path.join(os.tmpdir(), '.chrome.wright-' + path.basename(config.cwd)),
    '--remote-debugging-port=' + (config.debugPort)
  ]

  childProcess.spawn(utils.chromePath, args, { detached: true }).unref()
}
