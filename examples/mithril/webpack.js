const wright = require('../../lib')
    , webpack = require('webpack')

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
  const outputFilename = 'generated.js'
  const compiler = webpack({
    entry: './js/app.js',
    output: {
      filename: outputFilename
    },
    module: {
      rules: [
        {
          loader: 'babel-loader',
          test: /\.js$/,
          exclude: /node_modules/
        }
      ]
    }
  })

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err)
        return reject(err)

      const content = stats.compilation.assets[outputFilename].source()
      resolve(content)
    })
  })
}
