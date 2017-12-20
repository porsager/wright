'use strict'

const log = require('../log')
    , config = require('../config')
    , cp = require('child_process')
    , fs = require('fs')

module.exports = function() {
  const path = getPath()

  if (!fs.existsSync(path)) {
    console.error('\nCan\'t find Firefox at:\n' + path + '\n') // eslint-disable-line
    console.error('If firefox is installed somewhere else, set the environment variable FIREFOX_PATH\n') // eslint-disable-line
    return
  }

  const args = [
    '-new-instance',
    '-P "' + config.appData + '"',
    '-devtools',
    '-active',
    '-url', config.url
  ]

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
        log('\x1b[32mFirefox err:\x1b[0m', d.toString())
      else
        log.console.log(d.toString())

      lastStdErr = Date.now()
    })
  }

  if (config.debug > 2) {
    let lastStdOut = Date.now()

    child.stdout.on('data', d => {
      if (Date.now() - lastStdOut > 10)
        log('\x1b[32mFirefox out:\x1b[0m', d.toString())
      else
        log.console.log(d.toString())

      lastStdOut = Date.now()
    })
  }

}

function getPath() {
  if (process.env.FIREFOX_PATH) // eslint-disable-line
    return process.env.FIREFOX_PATH // eslint-disable-line

  if (process.platform === 'darwin') {
    return '/Applications/Firefox.app/Contents/MacOS/firefox'
  } else if (process.platform === 'linux') {
    return cp.execSync('which firefox', { encoding: 'utf8' }).trim()
  } else if (process.platform === 'win32') {
    return [
      process.env['PROGRAMFILES'] + '\\Mozilla Firefox\\firefox.exe',      // eslint-disable-line
      process.env['PROGRAMFILES(X86)'] + '\\Mozilla Firefox\\firefox.exe'  // eslint-disable-line
    ].find(fs.existsSync)
  }
}
