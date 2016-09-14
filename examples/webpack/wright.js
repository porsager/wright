const wright = require('../../lib')
    , webpack = require('webpack')

webpack({
  entry: './js/app.js',
  output: { filename: 'js/bundle.js' },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel',
      query: {
        presets: ['es2015']
      }
    }, {
      test: /\.css$/,
      loader: 'style-loader!css-loader'
    }]
  }
}).watch({}, (err, status) => {
  if (err)
    throw err

  wright({
    main: 'index.html',
    files: ['js/bundle.js'],
    debug: true,
    run: 'reload()'
  })
})
