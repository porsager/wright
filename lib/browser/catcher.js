import ubre from './ubre'

window.onerror = function(msg, file, line, col, err) { // eslint-disable-line
  err = (!err || typeof err === 'string') ? { message: msg || err } : err

  err.stack = (!err.stack || String(err) === err.stack)
    ? ('at ' + (file || 'unknown') + ':' + line + ':' + col)
    : err.stack

  ubre.publish('error', {
    message: err.message || String(err),
    error: err,
    stack: err.stack
  })
}
