const config = require('./config')
    , log = require('./log')
    , ui = require('./ui')
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
  log.debug('Spawning', obj.command)

  const notification = ui.notification('Executing', obj.command)

  setTimeout(notification.close, 5000)

  if (obj.process) {
    log.debug('Exiting', obj.command)
    obj.process.kill()
  }

  obj.process = childProcess.spawn(obj.command.split(' ')[0], obj.command.split(' ').slice(1), {
    shell: process.platform === 'win32'
  })
  obj.process.on('error', log.error)
  obj.process.on('exit', notification.done)
  obj.process.stdout.on('data', b => log('PS' + (i + 1), b.toString().replace(/\n$/, '')))
  obj.process.stderr.on('data', b => log.error('PS' + (i + 1), b.toString().replace(/\n$/, '')))
}

process.on('exit', () => {
  (config.execute || []).filter(s => s.process).forEach(s => s.process.kill())
})
