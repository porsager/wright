/* eslint no-console: 0 */

const minimist = require('minimist')
    , fs = require('fs')
    , path = require('path')
    , wright = require('../lib/')
    , pkg = require('../package.json')

const command = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    r: 'reload',
    v: 'version'
  }
})

const help = command.help || command.main === 'help'
const version = command.version || command.main === 'version'

if (help)
  console.log(fs.readFileSync(path.join(__dirname, 'help.md'), 'utf8').replace('${version}', pkg.version))
else if (version)
  console.log('wright version ' + pkg.version)
else
  wright(command._[0], command).catch(err => console.error(err))
