const wright = require('../../lib')
    , rollup = require('rollup')
    , nodeResolve = require('rollup-plugin-node-resolve')
    , commonJs = require('rollup-plugin-commonjs')

wright({
  main: 'index.html',
  debug: true,
  run: 'm.redraw',
  js: {
    watch: 'js/**/*.js',
    path: '/js/app.js',
    compile: roll
  }
})

function roll() {

  return rollup.rollup({
    entry: 'js/app.js',
    plugins: [
      nodeResolve(),
      commonJs()
    ]
  }).then(bundle => bundle.generate({ format: 'iife' }))

}
