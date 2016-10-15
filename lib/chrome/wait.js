'use strict'

const utils = require('../utils')
    , config = require('../config')

module.exports = function() {
  return utils.retryConnect(config.debugUrl + '/json/list', 10000)
}
