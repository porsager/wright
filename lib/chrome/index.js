const wait = require('./wait')
    , tabs = require('./tabs')
    , probe = require('./probe')
    , launch = require('./launch')
    , storage = require('./storage')
    , websockets = require('./websockets')

module.exports.start = function() {

  return Promise.resolve()
  .then(probe)
  .then(launch)
  .then(wait)
  .then(tabs)
  .then(websockets)
  .then(storage)

}
