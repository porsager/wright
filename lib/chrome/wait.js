'use strict'

const utils = require('../utils')
    , log = require('../log')
    , config = require('../config')

module.exports = function() {
  log.debug('Waiting for chrome to launch')
  return utils.retryConnect(config.debugUrl + '/json/list', 30000)
}
