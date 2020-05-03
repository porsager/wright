const ws = require('ws')
    , Url = require('url')
    , Ubre = require('ubre')
    , path = require('path')
    , config = require('../config')
    , log = require('../log')
    , utils = require('../utils')
    , js = require('./js')
    , SourceMap = require('source-map')

const wss = new ws.Server({ noServer: true, path: '/wright' })
const ubre = Ubre.wss(wss)

module.exports.ubre = ubre
module.exports.wss = wss

wss.on('connection', (socket, req) => {
  const ub = ubre(socket)

  ub.subscribe('error', err => {
    err.userAgent = req.headers['user-agent']
    err.ip = req.connection.remoteAddress
    log('Client error: ', err)
  })

  ub.subscribe('goto', ({
    url,
    line,
    column
  }) => {
    const filename = Url.parse(url).pathname
    const file = js.sourceMaps && js.sourceMaps[filename + '.map']
    if (!file)
      return utils.launchEditor(path.join(config.serve, filename) + ':' + line + ':' + column)

    SourceMap.SourceMapConsumer.with(file, null, consumer => {
      const result = consumer.originalPositionFor({
        line: parseInt(line),
        column: parseInt(column)
      })
      utils.launchEditor(result.source + ':' + result.line + ':' + result.column, config.editor)
    })
  })
  socket.on('error', () => { /* noop */ })
})
