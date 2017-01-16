const fs = require('fs')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')
    , chrome = require('./chrome')

module.exports = function() {
  if (!config.clone)
    return

  const flags = config.clone === 'overwrite' ? 'w' : 'wx'

  return chrome.send('Page.getResourceTree').then(result => {

    const file = path.join(config.serve, url.parse(result.frameTree.frame.url).pathname, 'index.html')

    return chrome.send('Page.getResourceContent', {
      frameId: result.frameTree.frame.id,
      url: result.frameTree.frame.url
    })
    .then(root => {
      fs.writeFileSync(file, root.content, { flag: flags })

      return Promise.all(result.frameTree.resources.filter(r => r.url.startsWith(result.frameTree.frame.url))
      .map(r => {
        if (!path.extname(r.url))
          return

        const file = path.join(config.serve, url.parse(r.url).pathname)

        ensureDirectoryExistence(file)
        return chrome.send('Page.getResourceContent', {
          frameId: result.frameTree.frame.id,
          url: r.url
        }).then(result => {
          fs.writeFileSync(file, result.content, {
            flag: flags,
            encoding: result.base64Encoded ? 'base64' : 'utf8'
          })
        })
      }))
    })
    .catch(err => {
      if (err.code === 'EEXIST') {
        log.error('Can\'t get ' + path.relative(config.serve, err.path) + ', it already exists')
        log.error('Clone won\'t overwrite files unless you pass \'overwrite\'')
      }
      process.exit() // eslint-disable-line
    })
  })
}

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath)

  if (fs.existsSync(dirname))
    return true

  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}
