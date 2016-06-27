/* eslint no-console: 0 */

function log() {
  console.log.apply(console, arguments)
}

log.error = function(err) {
  if (!err)
    return

  console.error.apply(console, arguments)
}

module.exports = log
