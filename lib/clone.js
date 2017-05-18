'use strict'

const fs = require('fs')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')

const cloned = new Set()

module.exports = function(req, res) {
  if (req.method !== 'GET')
    return

  const _write = res.write
      , _end = res.end
      , _writeHead = res.writeHead

  let stream

  res.write = function(buf) {
    _write.apply(res, arguments)

    if (stream)
      stream.write(buf)
  }

  res.end = function() {
    if (stream)
      stream.end()

    _end.apply(res, arguments)
  }

  res.writeHead = function(statusCode, headers) {
    _writeHead.apply(res, arguments)

    const localPath = path.join(config.serve, req.url + (req.url.endsWith('/') ? 'index.html' : '')).split('?')[0]

    if (statusCode !== 200 || cloned.has(localPath))
      return

    cloned.add(localPath)
    ensureDirectoryExistence(localPath)
    stream = fs.createWriteStream(localPath, { flags: config.clone === 'overwrite' ? 'w' : 'wx' })
    stream.on('error', () => {
      log.error(path.relative(config.serve, localPath) + ' exists. Pass \'--clone overwrite\' to force')
    })
    stream.on('close', () => {
      log.debug('cloned', path.relative(config.serve, localPath))
    })
  }
}

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath)

  if (fs.existsSync(dirname))
    return true

  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}
