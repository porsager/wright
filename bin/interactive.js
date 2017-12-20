/* eslint no-console: 0 */

const fs = require('fs')
    , path = require('path')
    , inquirer = require('inquirer')

const allowedMain = { '.html': 1, '.js': 1 }
    , basename = path.basename(process.cwd())
    , defaultJs = '.js .ts .ls'
    , defaultCss = '.css .sass .styl'

console.log(`

  _/          _/  _/_/_/    _/_/_/    _/_/_/  _/    _/  _/_/_/_/_/
 _/          _/  _/    _/    _/    _/        _/    _/      _/
_/    _/    _/  _/_/_/      _/    _/  _/_/  _/_/_/_/      _/
 _/  _/  _/    _/    _/    _/    _/    _/  _/    _/      _/
  _/  _/      _/    _/  _/_/_/    _/_/_/  _/    _/      _/

Run all your development with a best case live reload setup.

`)

const questions = [
  {
    type: 'list',
    name: 'main',
    message: 'What would you like to work on?',
    choices: [
      { name: 'A served site  (eg. http://localhost:3000)', short: 'url', value: 'url' },
      { name: 'Local files    (eg. index.html)', short: 'local', value: 'local' }
    ]
  }, {
    type: 'input',
    name: 'main',
    message: 'Enter url:',
    when: a => a.main === 'url',
    filter: v => v.startsWith('http://') ? v : ('http://' + v)
  }, {
    type: 'input',
    name: 'main',
    message: 'Enter path:',
    default: a => fs.existsSync(path.join(process.cwd(), 'index.html')) ? 'index.html' : '',
    when: a => a.main === 'local',
    validate: v => allowedMain[path.extname(v)]
      ? fs.existsSync(v)
        ? true
        : 'File not found'
      : 'Only .html and .js files allowed'
  }, {
    type: 'input',
    name: 'serve',
    default: './',
    message: 'Path for files served:',
    basePath: '.'
  }, {
    type: 'confirm',
    name: 'css',
    default: false,
    message: 'Run a css build script on changes?'
  }, {
    type: 'input',
    name: 'css.compile',
    default: 'npm run build:css',
    message: 'Command:',
    when: a => a.css
  }, {
    type: 'input',
    name: 'css.path',
    message: 'Path in link href:',
    default: '/css/style.css',
    when: a => a.css
  }, {
    type: 'input',
    name: 'css.watch',
    default: defaultCss,
    message: 'Files to watch:',
    filter: v => v === defaultCss ? null : v,
    when: a => a.css
  }, {
    type: 'confirm',
    name: 'js',
    default: false,
    message: 'Run a js build script on changes?'
  }, {
    type: 'input',
    name: 'js.compile',
    message: 'Command:',
    default: 'npm run build:js',
    when: a => a.js
  }, {
    type: 'input',
    name: 'js.path',
    message: 'Path in script src:',
    default: '/js/app.js',
    when: a => a.js
  }, {
    type: 'input',
    name: 'js.watch',
    default: defaultJs,
    message: 'Files to watch:',
    filter: v => v === defaultJs ? null : v,
    when: a => a.js
  }, {
    type: 'confirm',
    name: 'run',
    default: false,
    message: 'Activate live replacement of Javascript functions (HMR)'
  }, {
    type: 'input',
    name: 'run',
    default: 'run',
    message: 'Enter global function reference to run (eg m.redraw)',
    filter: value => value.replace('()', ''),
    when: a => a.run
  }, {
    type: 'confirm',
    name: 'watch',
    default: false,
    message: 'Full reload on specific file changes? (eg .php, .html, .jade)'
  }, {
    type: 'input',
    name: 'watch',
    message: 'Files to watch:',
    when: a => a.watch
  }, {
    type: 'confirm',
    name: 'execute',
    message: 'Execute a command at start or on file changes?',
    default: false,
    filter: v => v ? {} : false
  }, {
    type: 'input',
    name: 'execute.command',
    message: 'Command:',
    when: a => a.execute
  }, {
    type: 'confirm',
    name: 'execute.watch',
    message: 'Rerun the command on file changes?',
    when: a => a.execute
  }, {
    type: 'input',
    name: 'execute.watch',
    message: 'Files to watch:',
    when: a => a.execute.watch
  }, {
    type: 'input',
    name: 'name',
    default: () => basename,
    message: 'Enter a unique name for this project:'
  }, {
    type: 'confirm',
    name: 'debug',
    default: true,
    message: 'Would you like extra debugging output?'
  }, {
    type: 'list',
    name: 'output',
    message: 'For future use Wright has a CLI and JS API, which one would you like\n' +
             '  to generate the command/script for?',
    choices: [
      { name: 'CLI  (lean & easy - good for npm scripts)', short: 'cli', value: 'cli' },
      { name: 'JS   (allows for streaming builds into the browser)', short: 'js', value: 'js' },
      { name: 'Both', short: 'both', value: 'both' }
    ]
  }, {
    type: 'confirm',
    name: 'pkgjson',
    message: 'Add CLI command to package.json scripts',
    when: (a) => a.output !== 'js' && fs.existsSync(path.join(process.cwd(), 'package.json'))
  }, {
    type: 'input',
    name: 'pkgjson',
    message: 'Name for script',
    default: 'wright',
    when: (a) => a.pkgjson
  }, {
    type: 'input',
    name: 'jsPath',
    when: answers => answers.output !== 'cli',
    message: 'Name of js file to save',
    default: 'wright.js'
  }, {
    type: 'confirm',
    name: 'start',
    message: 'Would you like to run wright now?',
    default: false
  }
]

inquirer.prompt(questions).then(a => {
  const command = createCommand(a)

  if (a.jsPath)
    fs.writeFileSync(path.isAbsolute(a.jsPath) ? a.jsPath : path.join(process.cwd(), a.jsPath), createScript(a))

  if (a.output !== 'js') {

    if (a.pkgjson) {
      const pkgPath = path.join(process.cwd(), 'package.json') // eslint-disable-line
          , pkg = require(pkgPath) // eslint-disable-line
          , indentation = fs.readFileSync(pkgPath, 'utf8').replace(/\r\n/g, '\n').split('\n')[1].search(/[^\s\\]/)

      pkg.scripts.wright = command
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indentation))
    }

    console.log('\nRun this command to start wright:')
    console.log(command + '\n')

  }

  console.log('Thanks for setting up wright.')
  console.log('I hope you enjoy using it!')

  if (a.start) {
    if (a.jsPath)
      return require(a.jsPath) // eslint-disable-line

    require('child_process').execSync(command, { stdio:[0, 1, 2] }) // eslint-disable-line
  }
}).catch(err => console.error(err))

function createScript(a) {
  return `const wright = require('wright')

wright({
  main: '${ a.main }',
  debug: ${ String(a.debug) },
  serve: '${ String(a.serve) }',
  run: '${ a.run }',

${ a.css ? '' : '  /* See more in the docs' }
  css: [{
    compile: '${ a.css ? a.css.compile : '' }',
    path: '${ a.css ? a.css.path : '' }',
    watch: '${ a.css ? a.css.watch : '' }'
  }],
${ a.css ? '' : '  */'}
${ a.js ? '' : '  /* See more in the docs'}
  js: [{
    compile: '${ a.js ? a.js.compile : '' }',
    path: '${ a.js ? a.js.path : '' }',
    watch: '${ a.js ? a.js.watch : '' }'
  }],
${ a.js ? '' : '  */'}
${ a.execute ? '' : '  /* See more in the docs' }
  execute: [{
    command: ${ a.execute.command },
    watch: ${ a.execute.watch }
  }]
${ a.execute ? '' : '  */' }
})
`
}

function createCommand(a) {
  return ['wright',
          a.main,
          a.name && a.name !== basename && ('--name ' + a.name),
          a.serve && a.serve !== './' && ('--serve ' + a.serve),
          a.css && ('--css ' + getCommandString(a.css)),
          a.js && ('--js ' + getCommandString(a.js)),
          a.run && ('--run ' + a.run),
          a.execute && ('--execute ' + getExecuteString(a.execute)),
          a.debug && ('--debug 1')
         ].filter(n => n).join(' ')
}

function getCommandString(obj) {
  return '\'' + obj.command + ';' + (obj.path || '_') + ';' + (obj.watch || '_') + '\''
}

function getExecuteString(obj) {
  return '\'' + obj.command + ';' + (obj.watch || '') + '\''
}
