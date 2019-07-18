'use strict'

const fs = require('fs')
    , os = require('os')
    , url = require('url')
    , net = require('net')
    , path = require('path')
    , log = require('./log')
    , cp = require('child_process')
    , crypto = require('crypto')

const utils = module.exports

utils.req = function(url) {
  return url.indexOf('https') === 0
    ? require('https')
    : require('http')
}

const editors = ({
  darwin: {
    sublime: {
      path: '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
      args: target => target
    },
    code: {
      path: '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      args: target => ['--goto', target]
    },
    atom: {
      path: '/Applications/Atom.app/Contents/MacOS/Atom',
      args: target => target
    }
  },
  win32: {
    sublime: {
      path: '%ProgramFiles%\\Sublime Text 3\\sublime_text.exe',
      args: target => target
    },
    code: {
      path: '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe',
      args: target => ['--goto', target]
    },
    atom: {
      path: '%LOCALAPPDATA%\\atom\\atom.exe',
      args: target => target
    }
  },
  linux: {

  }
})[os.platform()]

utils.launchEditor = function(target, name = guessEditor()) {
  const editor = editors[name]
  if (editor && !fs.existsSync(editor.path))
    return log('Could not find editor', name, 'at', editor.path)

  cp.spawn(editor.path, [].concat(editor.args(target)), {
    stdio: 'ignore',
    detached: true
  }).unref()
}

function guessEditor() {
  return Object.keys(editors).find(editor =>
    fs.existsSync(editors[editor].path)
  )
}

utils.request = function(url) {
  return new Promise((resolve, reject) => {
    const req = utils.req(url).get(url, res => {
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

utils.getId = function(name) {
  return path.basename(path.join(process.cwd(), '..')) +
         '-' + name + '_' +
         crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 7)
}

utils.retryConnect = function(url, timeout) {
  return new Promise((resolve, reject) => {
    let timedOut = false

    setTimeout(() => {
      timedOut = true
      reject('Could not connect to ' + url)
    }, timeout)

    function connect() {
      utils.req(url).get(url, resolve).on('error', () => !timedOut && connect())
    }

    connect()
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

utils.wrightDataDirectory = function(process) {
  const HOME = x.env.HOMEPATH || x.env.HOME || ''
  
  const ubuntuOnWindowsPath = 
    [process.env]
    .filter( x => x.WSL_DISTRO_NAME )
    .flatMap( x => x.PATH ? [x.PATH] : [] )
    .flatMap(  x => x.split(':') )
    .flatMap( x => x.split('/mnt/c/Users').slice(1) )
    .flatMap( x => x.split('/').slice(1,2) )
    .map(
      username => ({ 
        node: '/mnt/c/Users/'+username+'/.wright', 
        chrome: 'C:\\Users\\'+username+'\\.wright' 
      })
    )

  const otherwise = 
    [process]
    .map( x => path.join(HOME, '.wright') )
    .map( x => ({ node:x, chrome: x }) )

  return [].concat(ubuntuOnWindowsPath, otherwise)
    .slice(0,1)
    .concat({ node: '.wright', chrome: '.wright' })
    .shift()
}

utils.getAppDataDirectory = function(process, name) {
  const wrightPath = utils.wrightDataDirectory(process)
      , projectPath = path.join(wrightPath.chrome, name)

  try {
    fs.mkdirSync(wrightPath.node)
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
  return new Promise((resolve, reject) => recursivePortTest(port, resolve))
}

function recursivePortTest(port, resolve) {
  utils.testPort(port)
    .then(p => resolve(p))
    .catch(() => recursivePortTest(port + 3, resolve))
}

utils.testPort = function(port, resolve) {
  const tester = net.createServer()

  return new Promise((resolve, reject) => {
    tester
      .once('error', reject)
      .once('listening', () => {
        tester.once('close', () => {
          let connected = false

          const client = net.connect(port, () => {
            connected = true
            client.destroy()
          })
            .once('error', (err) => connected = err.code !== 'ECONNREFUSED')
            .once('close', () => connected ? reject() : resolve(port))
        }).close()
      })
      .listen(port)
  })
}
