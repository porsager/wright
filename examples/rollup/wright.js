const wright = require('../../lib')
    , rollup = require('rollup')
    , stylus = require('stylus')
    , fs = require('fs')

wright({
  debug: true,
  run: 'window.reload',
  js: {
    watch: 'js/**/*.js',
    compile: roll
  },
  css: {
    watch: 'css/**/*.styl',
    compile: style
  }
})

function roll() {

  return rollup.rollup({
    entry: 'js/app.js'
  }).then(bundle => bundle.generate({ format: 'iife' }).code)

}

function style() {
  return new Promise((resolve, reject) => {
    fs.readFile('css/style.styl', 'utf8', (err, str) => {
      if (err)
        return reject(err)

      stylus(str).render((err, css) => err ? reject(err) : resolve(css))
    })
  })
}
