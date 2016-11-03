const config = require('./config')
    , log = require('./log')
    , chokidar = require('chokidar')
    , childProcess = require('child_process')

module.exports = function() {

  config.execute.forEach(execute)
  config.execute.filter(s => s.watch).forEach((s, i) => {
    chokidar.watch(s.watch, {
      ignoreInitial: true
    }).on('add', () => execute(s, i)).on('change', () => execute(s, i))
  })

}

function execute(obj, i) {
  log.debug('Spawning', obj.args)
  if (obj.process) {
    log.debug('Exiting', obj.args)
    obj.process.kill()
  }

  obj.process = childProcess.spawn(obj.args.split(' ')[0], obj.args.split(' ').slice(1))
  obj.process.on('error', log.error)
  obj.process.stdout.on('data', b => log('PS' + (i + 1), b.toString()))
  obj.process.stderr.on('data', b => log.error('PS' + (i + 1), b.toString()))
}

process.on('exit', () => {
  config.execute.filter(s => s.process).forEach(s => s.process.kill())
})
