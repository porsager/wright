'use strict'

const config = require('./config')

module.exports = function(code) {
  return config.jail
    ? code.replace(/(function.*(\)|=>)\s*{)/g, '$1eval("");')
    : code
}
