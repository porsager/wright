const wright = require('../../lib')
    , rollup = require('rollup')
    , nodeResolve = require('rollup-plugin-node-resolve')
    , commonJs = require('rollup-plugin-commonjs')

wright({
  run: 'm.redraw()',
  js: {
    path: 'js/**/*.js',
    promise: roll
  }
})

function roll() {

  return rollup.rollup({
    entry: 'js/app.js',
    plugins: [
      nodeResolve(),
      commonJs()
    ]
  }).then(bundle => bundle.generate({ format: 'iife' }).code)

}
