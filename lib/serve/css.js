const Url = require('url')
    , config = require('../config')
    , utils = require('../utils')
    , log = require('../log')

module.exports = (req, res, next) => {
  const pathname = Url.parse(req.url).pathname
      , css = config.css.find(f => f.path && f.path.toLowerCase() === pathname.toLowerCase())

  if (!css)
    return next()

  utils
    .promisify(css.compile)
    .then(css => {
      res.setHeader('Content-Type', 'text/css')
      res.end(css)
    })
    .catch(err => {
      log.error(err)
      res.statusCode = 500
      res.end(err)
    })
}
