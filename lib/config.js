'use strict'

const url = require('url')
    , log = require('./log')
    , path = require('path')
    , utils = require('./utils')
    , session = require('./session')
    , childProcess = require('child_process')

const config = module.exports

Object.assign(config, {
  name        : null,
  browser     : 'chrome',
  main        : null,
  run         : null,
  serve       : null,
  execute     : null,
  watch       : null,
  js          : null,
  css         : null,
  port        : null,
  jail        : true,
  debug       : false,
  fps         : false,
  clone       : false
})

config.set = function(options) {
  options = options || {}

  Object.keys(options).forEach(key => {
    if (config.hasOwnProperty(key) && key in options)
      config[key] = options[key]
    else
      throw new Error('The key ' + key + ' is not supported')
  })

  if (!config.name)
    config.name = path.basename(process.cwd())

  config.id = utils.getId(config.name)

  config.jail = Boolean(config.run) && config.jail

  if (config.main && config.main.match('^https?://'))
    config.external = config.main
  else if (config.main)
    config.main = path.isAbsolute(config.main) ? config.main : path.join(process.cwd(), config.main)
  else
    config.main = process.cwd()

  if (!config.serve)
    config.serve = config.external ? process.cwd() : path.dirname(config.main)

  if (!path.isAbsolute(config.serve))
    config.serve = path.normalize(path.join(process.cwd(), config.serve))

  config.appData = utils.getAppDataDirectory(config.id)

  config.execute = Array.isArray(config.execute) ? config.execute : config.execute ? [config.execute] : []
  config.execute = config.execute.map(s => typeof s === 'string' ? { command: s } : s)

  config.js = cleanInjects(config.js, '.js', '**/*.{js,ls,purs,ts,cljs,coffee,litcoffee,jsx}')
  config.css = cleanInjects(config.css, '.css', '**/*.{css,styl,less,sass}')

  if (!config.port)
    config.port = session.get('port')

  return Promise.resolve(config.port
    ? utils.testPort(config.port)
    : utils.nextFreePort(session.portStart())
  )
  .then(port => {
    config.port = port
    session.set('port', config.port)
    config.url = utils.cleanUrl('http://localhost:' + config.port)

    config.debugPort = session.get('debugPort') || (config.port + 1)
    config.debugUrl = 'http://localhost:' + config.debugPort

    if (config.debug === 1)
      log.debug(config)
  })
  .catch(err => {
    if (err.code === 'EADDRINUSE')
      log.error('It appears port ' + config.port + ' is in use. Are you already running this project?')
    process.exit() // eslint-disable-line
  })
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
