'use strict'

const fs = require('fs')
    , url = require('url')
    , path = require('path')
    , log = require('./log')
    , utils = require('./utils')
    , session = require('./session')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  run         : null,
  runAll      : null,
  jsDelay     : 50,
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

  config.external = config.main.startsWith('http://') && config.main

  config.url = utils.cleanUrl('http://localhost:' + config.port)

  if (!config.name)
    config.name = path.basename(process.cwd())

  if (!config.serve)
    config.serve = config.external ? process.cwd() : path.dirname(config.main)
  else if (!path.isAbsolute(config.serve))
    config.serve = path.normalize(path.join(process.cwd(), config.serve))

  config.appData = utils.getAppDataDirectory(config.name)

  if (config.run && config.run.endsWith('.js'))
    config.run = fs.readFileSync(config.run, 'utf8')

  if (config.runAll && config.runAll.endsWith('.js'))
    config.runAll = fs.readFileSync(config.runAll, 'utf8')

  config.js = Array.isArray(config.js) ? config.js : config.js ? [config.js] : []
  config.js.filter(js => js.path).forEach(js => js.path = url.resolve('/', js.path))
  config.js.filter(js => !js.path).forEach(setInjectPath('.js'))

  config.css = Array.isArray(config.css) ? config.css : config.css ? [config.css] : []
  config.css.filter(css => css.path).forEach(css => css.path = url.resolve('/', css.path))
  config.css.filter(css => !css.path).forEach(setInjectPath('.css'))

  config.debugPort = session.get('debugPort') || (config.port + 1)
  config.debugProxyPort = session.get('debugProxyPort') || (config.debugPort + 1)
  config.debugUrl = 'http://localhost:' + config.debugPort

  if (config.debug === 1)
    log.debug(config)
}

function setInjectPath(ext) {
  return (obj, i) => {
    obj.inject = true
    obj.path = '/wrightinjected' + (i || '') + ext
  }
}
