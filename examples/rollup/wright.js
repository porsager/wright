const wright = require('../../lib')
    , rollup = require('rollup')
    , path = require('path')

wright({
  run: 'window.reload()'
}).then(browser => {

  browser.watch.on('all', (event, file) => {
    const ext = path.extname(file)

    if (ext === '.js')
      roll().then(browser.inject)
  })

  return roll().then(browser.inject)
})

function roll() {

  return rollup.rollup({
    entry: 'src/app.js'
  }).then(bundle => {

    return bundle.generate({ format: 'iife' }).code

  })
}
