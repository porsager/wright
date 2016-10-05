'use strict'

const fs = require('fs')
    , url = require('url')
    , net = require('net')
    , path = require('path')
    , http = require('http')

const utils = module.exports

utils.request = function(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = ''

      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        } else {
          reject(new Error(data))
        }
      })
      res.on('error', reject)
    }).on('error', reject)

    setTimeout(() => {
      req.abort()
      reject()
    }, 2000)
  })
}

utils.promisify = function(fn) {
  return new Promise((resolve, reject) => {
    try {
      const result = fn((err, result) => err ? reject(err) : resolve(result))

      if (result && result.then)
        result.then(resolve).catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}

utils.chromePath = (function() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'linux') {
    return 'google-chrome'
  } else if (process.platform === 'win32') {
    return [
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',      // eslint-disable-line
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'  // eslint-disable-line
    ].find(fs.existsSync)
  }
}())

utils.wrightDataDirectory = (function() {
  let root = ''

  if (process.platform === 'darwin')
    root = path.join(process.env.HOME, '/Library/Application Support') // eslint-disable-line
  else if (process.platform === 'win32')
    root = process.env.APPDATA || '' // eslint-disable-line
  else
    root = '/var/local'

  return path.join(root, 'wright')
}())

utils.getAppDataDirectory = function(name) {
  const wrightPath = utils.wrightDataDirectory
      , projectPath = path.join(wrightPath, name)

  try {
    fs.mkdirSync(wrightPath)
  } catch (_) {
    // don't care for errors (they exist)
  }

  try {
    fs.mkdirSync(projectPath)
  } catch (_) {
    // don't care for errors (they exist)
  }

  return projectPath
}

utils.cleanUrl = function(u) {
  const obj = url.parse(u)

  if (obj.port == 80) // eslint-disable-line
    obj.host = obj.hostname

  return url.format(obj)
}

utils.slash = function(string) {
  const isExtendedLengthPath = /^\\\\\?\\/.test(string)
      , hasNonAscii = /[^\x00-\x80]+/.test(string)

  if (isExtendedLengthPath || hasNonAscii)
    return string

  return string.replace(/\\/g, '/')
}

utils.nextFreePort = function(port) {
  return new Promise((resolve, reject) => testPort(port, resolve) )
}

function testPort(port, resolve) {
  const tester = net.createServer()

  tester
  .once('error', () => testPort(port + 1, resolve))
  .once('listening', () => {
    tester.once('close', () => {
      let connected = false

      const client = net.connect(port, () => {
        connected = true
        client.destroy()
      })
      .once('error', (err) => connected = err.code !== 'ECONNREFUSED')
      .once('close', () => connected ? testPort(port + 1, resolve) : resolve(port))
    }).close()
  })
  .listen(port)
}

utils.uninstall = function(path) {
  fs.rmdirSync(utils.wrightDataDirectory)
}
