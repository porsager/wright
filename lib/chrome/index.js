const api = require('./api')
    , wait = require('./wait')
    , tabs = require('./tabs')
    , launch = require('./launch')
    , websockets = require('./websockets')

module.exports.start = function() {

  return Promise.resolve()
  .then(launch)
  .then(wait)
  .then(tabs)
  .then(websockets)
  .then(api)

}
