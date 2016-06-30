const path = require('path')
    , utils = require('./utils')

const config = module.exports

Object.assign(config, {
  main        : null,
  reload      : null,
  host        : 'localhost',
  port        : 3000,
  debugHost   : 'localhost',
  debugPort   : 9222
})

config.set = function(options) {
  Object.keys(options).forEach(key => {
    if (config.hasOwnProperty(key))
      config[key] = options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  if (!config.main)
    config.main = ''

  config.scripts = utils.Stream()

  if (typeof config.main === 'number')
    config.url = 'http://localhost:' + config.main
  else if (config.main.startsWith('http://'))
    config.url = config.main

  if (!config.url && config.main.endsWith('index.html'))
    config.cwd = path.join(process.cwd(), path.dirname(config.main))
  else
    config.cwd = process.cwd()

  config.chromeUrl = 'http://' + config.debugHost + ':' + config.debugPort
  config.debugProxyPort = config.debugPort - 1
}
