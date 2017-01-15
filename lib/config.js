'use strict'

const fs = require('fs')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , utils = require('./utils')
    , session = require('./session')
    , childProcess = require('child_process')

const config = module.exports

Object.assign(config, {
  name        : null,
  main        : null,
  run         : null,
  runAll      : null,
  serve       : null,
  execute     : null,
  watch       : null,
  jail        : true,
  js          : null,
  css         : null,
  port        : 3000,
  debug       : false,
  fps         : false,
  clone       : false
})

config.set = function(options) {
  options = options || {}

  Object.keys(options).forEach(key => {
    if (config.hasOwnProperty(key))
      config[key] = typeof options[key] === 'undefined' ? config[key] : options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  config.jail = Boolean(config.run) && config.jail

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

  config.execute = Array.isArray(config.execute) ? config.execute : config.execute ? [config.execute] : []
  config.execute = config.execute.map(s => typeof s === 'string' ? { args: s } : s)

  config.js = cleanInjects(config.js, '.js', '**/*.{js,ls,purs,ts,cljs,coffee,litcoffee,jsx}')
  config.css = cleanInjects(config.css, '.css', '**/*.{css,styl,less,sass}')

  config.debugPort = session.get('debugPort') || (config.port + 1)
  config.debugProxyPort = session.get('debugProxyPort') || (config.debugPort + 1)
  config.debugUrl = 'http://localhost:' + config.debugPort

  if (config.debug === 1)
    log.debug(config)
}

function cleanInjects(injects, ext, watch) {
  injects = Array.isArray(injects) ? injects : injects ? [injects] : []
  injects = injects.map(inject => typeof inject === 'function' ? { compile: inject } : inject)
  injects = injects.map(inject => typeof inject === 'string' ? { compile: inject } : inject)
  injects.filter(inject => typeof inject.compile === 'string').forEach(processifyCompile)
  injects.filter(inject => inject.path).forEach(inject => inject.path = url.resolve('/', inject.path))
  injects.filter(inject => !inject.path).forEach(setInjectPath(ext))
  injects.filter(inject => !inject.watch).forEach(inject => inject.watch = watch)

  return injects
}

function setInjectPath(ext) {
  return (obj, i) => {
    obj.inject = true
    obj.path = '/wrightinjected' + (i || '') + ext
  }
}

function processifyCompile(obj) {
  const args = obj.compile

  obj.compile = function(callback) {
    childProcess.exec(args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    }, (err, stdout, stderr) => {
      callback(err || stderr, stdout)
    })
  }
}
