/* eslint no-console: 0 */

function log() {
  addTime(arguments)
  console.log.apply(console, arguments)
}

log.error = function(err) {
  if (!err)
    return

  Array.prototype.unshift.call(arguments, '\x1b[31mError:\x1b[0m')
  addTime(arguments)
  console.error.apply(console, arguments)
}

log.debug = function(a, b, c) {
  if ((a || b || c) && log.debugging) {
    Array.prototype.unshift.call(arguments, '\x1b[32mDebug:\x1b[0m')
    log.apply(null, arguments)
  }
}

function addTime(args) {
  const now = new Date()
      , h = pad(now.getHours(), 2)
      , m = pad(now.getMinutes(), 2)
      , s = pad(now.getSeconds(), 2)
      , ms = pad(now.getMilliseconds(), 3)
      , stamp = '\x1b[2m' + h + ':' + m + ':' + s + '.' + ms + '\x1b[0m'

  Array.prototype.unshift.call(args, stamp)
}

log.console = console

function pad(str, len) {
  str = String(str)
  while (str.length < len)
    str = '0' + str

  return str
}

module.exports = log
