'use strict'

const path = require('path')
    , url = require('url')
    , fs = require('fs')
    , log = require('./log')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  files       : [],
  run         : null,
  serve       : null,
  watch       : null,
  js          : null,
  jail        : null,
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

  config.url = cleanUrl(config.url)

  if (config.main.endsWith('.html'))
    config.cwd = path.join(process.cwd(), path.dirname(config.main))
  else
    config.cwd = process.cwd()

  if (!config.name)
    config.name = path.basename(config.cwd)

  if (config.serve)
    config.serve = path.join(process.cwd(), config.serve)
  else
    config.serve = config.cwd

  config.appData = getAppDataDirectory(config.name)

  if (config.run && config.run.endsWith('.js'))
    config.run = fs.readFileSync(config.run, 'utf8')

  log.debug(config)
}

function getAppDataDirectory(name) {
  let root = ''

  if (process.platform === 'darwin')
    root = path.join(process.env.HOME, '/Library/Application Support') // eslint-disable-line
  else if (process.platform === 'win32')
    root = process.env.APPDATA || '' // eslint-disable-line

  return path.join(root || '', 'wright', name)
}

function cleanUrl(u) {
  const obj = url.parse(u)

  if (obj.port == 80) // eslint-disable-line
    obj.host = obj.hostname

  return url.format(obj)
}
