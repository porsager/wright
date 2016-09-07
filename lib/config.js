'use strict'

const path = require('path')
    , fs = require('fs')
    , log = require('./log')
    , utils = require('./utils')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  files       : [],
  run         : null,
  serve       : null,
  watch       : null,
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
      config[key] = options[key] || config[key]
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

  config.url = utils.cleanUrl(config.url)

  if (!config.name)
    config.name = path.basename(process.cwd())

  if (config.serve)
    config.serve = path.join(process.cwd(), config.serve)
  else
    config.serve = config.main.endsWith('.html') ? path.join(process.cwd(), path.dirname(config.main)) : process.cwd()

  config.appData = utils.getAppDataDirectory(config.name)

  if (config.run && config.run.endsWith('.js'))
    config.run = fs.readFileSync(config.run, 'utf8')

  config.js = Array.isArray(config.js) ? config.js : config.js ? [config.js] : []
  config.js.forEach((file, i) => {
    file.path = file.path || 'wright_injected_' + i + '.js'
    config.files.push(file.path)
  })

  config.css = Array.isArray(config.css) ? config.css : config.css ? [config.css] : []
  config.css.forEach((file, i) => {
    file.path = file.path || 'wright_injected_' + i + '.css'
    config.files.push(file.path)
  })

  log.debug(config)
}
