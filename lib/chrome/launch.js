'use strict'

const log = require('../log')
    , config = require('../config')
    , cp = require('child_process')
    , fs = require('fs')

module.exports = function() {
  const path = getPath()

  if (!fs.existsSync(path)) {
    console.error('\nCan\'t find Chrome at:\n' + path + '\n') // eslint-disable-line
    console.error('If Chrome is installed somewhere else, set the environment variable CHROME_PATH\n') // eslint-disable-line
    return
  }

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--auto-open-devtools-for-tabs',
    '--restore-last-session',
    '--disable-web-security',
    '--disable-translate',
    '--disable-infobars',
    '--user-data-dir=' + config.appData,
    '--remote-debugging-port=' + (config.debugPort)
  ]

  if (config.debug === 2)
    args.push('--enable-logging=stderr')

  if (config.fps)
    args.push('--show-fps-counter')

  const child = cp.spawn(path, args, { detached: process.platform !== 'win32' })

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

function getPath() {
  if (process.env.CHROME_PATH) // eslint-disable-line
    return process.env.CHROME_PATH // eslint-disable-line

  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'linux') {
    return cp.execSync('which google-chrome', { encoding: 'utf8' }).trim()
  } else if (process.platform === 'win32') {
    return [
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'  // eslint-disable-line
    ].find(fs.existsSync)
  }
}
