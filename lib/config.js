const path = require('path')
    , u = require('./utils')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  run         : null,
  serve       : null,
  js          : null,
  css         : null,
  port        : 3000,
  debug       : false,
  fps         : false
})

config.set = function(options) {
  options = options || {}

  Object.keys(options).forEach(key => {
    if (config.hasOwnProperty(key))
      config[key] = options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  if (!config.main)
    config.main = ''

  if (typeof config.main === 'number')
    config.port = config.main

  if (config.main.startsWith('http://'))
    config.url = config.main
  else
    config.url = 'http://localhost:' + config.port

  if (config.main.endsWith('.html'))
    config.cwd = path.join(process.cwd(), path.dirname(config.main))
  else
    config.cwd = process.cwd()

  if (!config.name)
    config.name = path.basename(config.cwd)

  if (config.serve)
    config.serve = path.join(process.cwd(), config.serve)
  else if (!config.main.startsWith('http://'))
    config.serve = config.cwd

  return resolveFreePorts
}

function resolveFreePorts() {
  return u.nextFreePort(config.port)
          .then(port => config.port = port)
          .then(() => u.nextFreePort(config.port + 1))
          .then(port => config.debugPort = port)
          .then(() => u.nextFreePort(config.debugPort + 1))
          .then(port => config.debugProxyPort = port)
          .then(() => config.chromeUrl = 'http://localhost:' + config.debugPort)
}
