const fs = require('fs')
    , http = require('http')

module.exports.request = function(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = ''

      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        } else {
          reject(new Error({ statusCode: res.statusCode, body: data }))
        }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

module.exports.chromePath = (function() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  } else if (process.platform === 'linux') {
    return 'google-chrome'
  } else if (process.platform === 'win32') {
    return [
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe',
      process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
    ].find(fs.fileExistsSync)
  }
}())
