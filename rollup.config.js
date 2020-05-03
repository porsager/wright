import buble from 'rollup-plugin-buble'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

export default {
  input: 'lib/browser/index.js',
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    buble({
      transforms: {
        dangerousTaggedTemplateString: true
      }
    })
  ],
  output: {
    file: 'lib/browser/wright.js',
    format: 'iife',
    sourcemap: true
  }
}
