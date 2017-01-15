const fs = require('fs')
    , url = require('url')
    , log = require('./log')
    , path = require('path')
    , config = require('./config')
    , chrome = require('./chrome')

module.exports = function() {
  if (!config.clone)
    return

  return chrome.send('Page.getResourceTree').then(result => {

    const file = path.join(config.serve, url.parse(result.frameTree.frame.url).pathname, 'index.html')

    chrome.send('Page.getResourceContent', {
      frameId: result.frameTree.frame.id,
      url: result.frameTree.frame.url
    })
    .then(result => fs.writeFile(file, result.content, log.error))
    .catch(log.error)

    result.frameTree.resources.filter(r => r.url.startsWith(result.frameTree.frame.url))
    .forEach(r => {
      if (!path.extname(r.url))
        return

      const file = path.join(config.serve, url.parse(r.url).pathname)

      ensureDirectoryExistence(file)
      chrome.send('Page.getResourceContent', {
        frameId: result.frameTree.frame.id,
        url: r.url
      }).then(result => {
        fs.writeFile(file, result.content, {
          encoding: result.base64Encoded ? 'base64' : 'utf8'
        }, log.error)
      }).catch(log.error)
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
