'use strict'

const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , utils = require('./utils')
    , sessions = require('./sessions')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  run         : null,
  runAll      : null,
  jsDelay     : 50,
  cssDelay    : 50,
  serve       : null,
  watch       : null,
  jail        : true,
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
      config[key] = typeof options[key] === 'undefined' ? config[key] : options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  if (!config.main)
    config.main = process.cwd()

  config.external = config.main.startsWith('http://')

  config.url = utils.cleanUrl(config.external ? config.main : ('http://localhost:' + config.port))

  if (!config.name)
    config.name = path.basename(process.cwd())

  if (config.serve && !path.isAbsolute(config.serve))
    config.serve = path.join(process.cwd(), config.serve)
  else
    config.serve = config.external ? process.cwd() : path.join(process.cwd(), path.dirname(config.main))

  config.appData = utils.getAppDataDirectory(config.name)

  if (config.run && config.run.endsWith('.js'))
    config.run = fs.readFileSync(config.run, 'utf8')

  if (config.runAll && config.runAll.endsWith('.js'))
    config.runAll = fs.readFileSync(config.runAll, 'utf8')

  config.js = Array.isArray(config.js) ? config.js : config.js ? [config.js] : []
  config.js.forEach((file, i) => file.path = '/wrightinjected' + (i || '') + '.js')

  config.css = Array.isArray(config.css) ? config.css : config.css ? [config.css] : []
  config.css.forEach((file, i) => file.path = '/wrightinjected' + (i || '') + '.css')

  config.debugPort = sessions.get('debugPort') || (config.port + 1)
  config.debugProxyPort = sessions.get('debugProxyPort') || (config.debugPort + 1)
  config.debugUrl = 'http://localhost:' + config.debugPort

  config.jsDelay = Number(config.jsDelay)
  config.cssDelay = Number(config.cssDelay)

  log.debug(config)
}
