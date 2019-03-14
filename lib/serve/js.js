const Url = require('url')
    , path = require('path')
    , config = require('../config')
    , utils = require('../utils')
    , log = require('../log')
    , assets = require('../watch/assets')
    , jail = require('../jail')
    , fs = require('fs')
    , cp = require('child_process')

const sourceMaps = {}
    , staticImportRegex = new RegExp('((?:import|export)\\s*[{}0-9a-zA-Z*,\\s]*\\s*(?: from |)[\'"])([a-zA-Z1-9@][a-zA-Z0-9@/._-]*)([\'"])', 'g')
    , dynamicImportRegex = new RegExp('([^$.]import\\(\\s?[\'"])([a-zA-Z1-9@][a-zA-Z0-9@\\/._-]*)([\'"]\\s?\\))', 'g')
    , moduleRegex = /(?:(?:import|export)\s+(?:[\s\S]+?\s+from\s+)?["']\S+?["'])|(?:export\s+(?:default|function|class|var|const|let|async)\s)|(?:import\s*\(\s*[`'"])(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/
    , commentsRegex = /\/\*[\s\S]*?\*\/|\/\/[\s\S]*?(?:\n|$)/g

const isModule = s => moduleRegex.test(s.replace(commentsRegex, ''))

module.exports = {
  compile,
  rewrite,
  sourceMap,
  modules
}

function compile(req, res, next) {
  const pathname = Url.parse(req.url).pathname
  const js = config.js.find(f => f.path && f.path.toLowerCase() === pathname.toLowerCase())
  if (!js)
    return next()

  utils.promisify(js.compile).then(content => {
    if (!content || (typeof content !== 'string' && typeof content.code !== 'string'))
      throw new Error('The compile function should resolve with a code string or a { code, map } object')

    if (content.map) {
      sourceMaps[js.path + '.map'] = content.map
      res.setHeader('SourceMap', js.path + '.map')
    }

    res.setHeader('Content-Type', 'application/javascript')
    res.end(jail(content.code
      ? content.code + '\n//# sourceMappingURL=' + js.path + '.map'
      : (content.code || content)))
  }).catch((err) => {
    log.error(err)
    res.statusCode = 500
    res.end(err)
  })
}

function sourceMap(req, res, next) {
  req.url in sourceMaps
    ? res.end(JSON.stringify(sourceMaps[req.url]))
    : next()
}

function modules(req, res, next) {
  if (req.url.indexOf('/node_modules/') !== 0)
    return next()

  const pkg = parseNpm(req.url.slice('/node_modules/'.length))

  getStat(pkg.root)
    .catch(() => npmInstall(pkg))
    .then(() =>
      getStat(pkg.path)
        .catch(() => {
          pkg.path += '.js'
          return getStat(pkg.path)
        })
        .catch(() => {
          pkg.path = path.join(pkg.path.slice(0, -3), 'index.js')
          return getStat(pkg.path)
        })
    )
    .then(stat =>
      stat.isFile()
        ? pkg.path
        : resolveEntry(pkg.path).then(x => path.join(...x.split('/')))
    )
    .then(location => {
      res.statusCode = 302
      // isJS['/' + location] = true
      res.setHeader('Location', '/' + location.split(path.sep).join('/'))
      res.end()
    })
    .catch((err) => {
      res.statusCode = 500
      log('Error loading package', err)
      res.end('Wright could not autoload ' + pkg.name)
    })
}

function getStat(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      err ? reject(err) : resolve(stat)
    })
  })
}

function rewrite(req, res, next) {
  const ext = path.extname(req.pathname)
  if (ext === '.css' || (!req.url.startsWith('/node_modules/') && ext !== '.js' && ext === '.mjs'))
    return next()

  const filePath = path.join(req.url.startsWith('/node_modules/')
    ? process.cwd()
    : config.serve, Url.parse(req.url).pathname)

  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err || !isModule(content))
      return next()

    assets.watch(filePath)
    res.setHeader('Content-Type', 'text/javascript')
    res.end(rewritePath(jail(content)))
  })
}

function rewritePath(content) {
  return content
    .replace(staticImportRegex, (_, a, b, c) => {
      // isJS['/node_modules/' + b] = true
      return a + '/node_modules/' + b + c
    })
    .replace(dynamicImportRegex, (_, a, b, c) => {
      // isJS['/node_modules/' + b] = true
      a + '/node_modules/' + b + c
    })
}

function resolveEntry(p) {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(p, 'package.json'), 'utf8', (err, content) =>
      err ? reject(err) : resolve(content)
    )
  })
    .catch(() => {
      const newPath = path.dirname(p)
      if (newPath === p)
        throw new Error('package.json not found')

      return resolveEntry(newPath)
    })
    .then(JSON.parse)
    .then(x => p + '/' + (x.module || x.unpkg || x.main || 'index.js'))
}

function npmInstall(pkg) {
  return new Promise(resolve => {
    log.debug(pkg.name + ' not found. Running npm install ' + pkg.install)
    cp.exec('npm install ' + pkg.install, { encoding: 'utf8' }, resolve)
  })
}

function parseNpm(n) {
  const parts = n.split('/')
      , scoped = n[0] === '@'
      , install = parts.slice(0, scoped ? 2 : 1).join('/')
      , name = install.replace(/(.+)@.*/, '$1')

  return {
    name,
    install,
    root: path.join('node_modules', ...name.split('/')),
    path: path.join('node_modules', ...name.split('/'), ...parts.slice(scoped ? 2 : 1))
  }
}
