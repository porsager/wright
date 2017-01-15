const wright = require('../../lib')
    , browserify = require('browserify')

wright({
  main: 'index.html',
  debug: true,
  run: 'm.redraw',
  js: {
    watch: 'js/**/*.js',
    compile: compile
  }
})

function compile() {

  return new Promise((resolve, reject) => {
    browserify('./js/app.js')
    .transform('babelify', { presets: ['es2015'] })
    .bundle((err, src) => err ? reject(err) : resolve(src.toString()))
  })

}
