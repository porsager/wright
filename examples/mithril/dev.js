const wright = require('../../lib')
    , rollup = require('rollup')
    , nodeResolve = require('rollup-plugin-node-resolve')
    , commonJs = require('rollup-plugin-commonjs')
    , path = require('path')

wright({
  run: 'window.m.redraw()'
}).then(browser => {

  browser.watch.on('all', (event, file) => {
    const ext = path.extname(file)

    if (ext === '.js')
      roll().then(browser.inject)
  })

  return roll().then(browser.inject)
}).catch(err => console.log(err))

function roll() {

  return rollup.rollup({
    entry: 'js/app.js',
    plugins: [
        nodeResolve()
      , commonJs()
    ]
  }).then(bundle => bundle.generate({ format: 'iife' }).code)
  .catch(err => console.log(err))
}
