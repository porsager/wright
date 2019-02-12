/* eslint no-process-env: 0 */

'use strict'

const config = require('./config')

const processEnv = /process\.env\.([a-z0-9_]*?)([^a-z0-9_]|$)/gi

module.exports = function(code) {
  return (config.jail
    ? code.replace(/((function.*?\)|=>)\s*{)/g, '$1eval(0);')
    : code).replace(processEnv, (a, b, c) => b in process.env ? JSON.stringify(process.env[b]) + c : a)
}
