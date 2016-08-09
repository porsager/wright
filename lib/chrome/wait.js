'use strict'

const utils = require('../utils')
    , config = require('../config')

module.exports = function() {
  return new Promise((resolve, reject) => {
    let retries = 0

    function ready() {
      utils.request(config.chromeUrl).then(() => resolve()).catch(() => {
        retries++
        if (retries < 100)
          setTimeout(ready, 50)
        else
          reject(new Error('Could not connect to remote debugging port'))
      })
    }

    ready()
  })
}
