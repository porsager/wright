const config = require('../config')
    , fs = require('fs')
    , log = require('../log')

let injectedJs
  , injectedCss
  , extraByteLength

const injectedWright = `<script type="text/javascript" id="wrightSocket" charset="utf-8" src="/wright.js"></script>
<script type="text/javascript">window.process = { env: ${ JSON.stringify(process.env) } }</script>`

module.exports = {
  init,
  hijack,
  index
}

function init() {
  const injectAll = !config.external && !config.main.endsWith('.html')

  injectedJs = config.js.filter(js => injectAll || js.inject).map(js => js.path).map(x => scriptTag(x)).join('')
  injectedCss = config.css.filter(css => injectAll || css.inject).map(css => css.path).map(linkTag).join('')
  extraByteLength = Buffer.byteLength(injectedCss + injectedJs + injectedWright, 'utf8')
}

function hijack(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const _write = res.write
      , _end = res.end
      , _writeHead = res.writeHead

  let content = ''

  res.write = function(buf) {
    content += buf.toString()
  }

  res.end = function(a) {
    _write.call(res, addFiles(content))
    _end.apply(res, arguments)
  }

  res.writeHead = function() {
    res.setHeader('Content-Length', Number(res.getHeader('content-length')) + extraByteLength)
    _writeHead.apply(res, arguments)
  }
}

function index(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (config.main.endsWith('.js'))
    return res.end(addFiles(html(config.name) + scriptTag(config.main.replace(config.serve, ''), true)))

  if (!config.main.endsWith('.html'))
    return res.end(addFiles(html(config.name)))

  fs.readFile(config.main, 'utf8', (err, content) => {
    if (err)
      return log.error('Error reading', config.main, err)

    res.end(addFiles(content))
  })
}

function addFiles(content) {
  return (content.includes('<meta charset')
    ? content.replace(/(<meta charset.*?>)/i, '$1' + injectedCss + injectedWright)
    : content.replace('>', '>' + injectedCss + injectedWright)
  ) + injectedJs
}

function html(title) {
  return `<!DOCTYPE html>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wright /${ title }</title>
  <body></body>
`
}

function scriptTag(file, module) {
  return '\n<script src="/' + file.replace(/^\//, '') + '" type="' + (module ? 'module' : 'text/javascript') + '" charset="utf-8"></script>'
}

function linkTag(file) {
  return '\n<link rel="stylesheet" type="text/css" href="' + file + '">'
}
