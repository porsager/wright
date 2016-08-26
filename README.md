# Wright

#### Hot Module Reloading: at the *Virtual Machine* level

- Compatible with any framework (or no framework at all)
- Patches your JS, CSS and Static Assets on change without losing instance state
- Uses the Chrome Debugger Protocol to replace the source files in the VM
- Convenient CLI for lightweight build systems / npm scripts
- Fallback to regular refresh if the Chrome Debugger Protocol is not available

## Framework Support

Wright is framework agnostic because the code patching happens at the VM level.

Wright has been tested with many frameworks, and there are plenty of examples to help get you started.

Tested successfully with:

- React
- [Mithril](https://github.com/porsager/Wright/tree/master/examples/mithril)
- [Rollup](https://github.com/porsager/Wright/tree/master/examples/rollup)
- Rollup
- Browserify
- stylus
- postcss
- candylize
- fragmentor
- pistontulastic

Currently works with Chrome, tested on OSX & Windows 10.

Wright automatically watches any resource (js, css, image, font) that is loaded in the browser, and hot reloads it when it changes.

## CLI API
```
$ npm install -g wright
```
Using wright as a cli makes it easy to get started right away or to set up your project with npm scripts.

## Options
```
main              Main should specify the entry point of your app. If you have
                  an index.html file that would be it or if you have an app.js
                  file use that. You can also specify a local port or a full 
                  url if you already have a server running.

Standard Options:

-r,  --run        Input javascript as a string or point to a js file to run
                  after a script on the site was hot loaded

-s,  --serve      Specify which directory to serve
                  Defaults to root of main html file or CWD
```
#### Example with all options
```
$ wright public/app.js -s ./public -r "m.redraw()"
```

## Javascript API

Using wright with javascript is great if you have some build steps or compilation that needs to happen before hot reloading js or css.

```
$ npm install -D wright
```

Wright exports one function which takes an object that defines hot reloading.

```
const wright = require('wright')

wright({

  main    : 'public/index.html',
  serve   : 'public',
  run     : 'm.redraw()'
  js      : {
    watch   : 'src/js/**/*.js'
    compile : () => rollup()
  },
  css: {
    watch   : 'src/css/**/*.js'
    compile : () => stylus()
  }
})
```

### Options


#### main
Main should specify the entry point of your app. If you have an index.html file that would be it or if you have an app.js file use that. You can also specify a local port or a full url if you already have a server running.
If you don't specify main wright will use a boilerplate html file and expect you to use the js & css options for injecting your code.

#### serve
Specify which directory to serve. Defaults to root of main html file or CWD.

#### run
Input javascript as a string or point to a js file to run after a script on the site was hot loaded.

#### js & css
Should return an object containing a watch and compile key.

**watch** directory, file, glob pattern or array of those to watch.

**compile** function or promise returning a compiled string.

## Examples

- Mithril
- Vanilla

## Advanced

The options object also takes the following more advanced properties:

**port** (default 3000)
The port to serve from

**debug** (default false)
Set to true to receive debugging info in the console, or to 2 to also receive chrome output

**fps** (default false)
Activate the chrome fps gui widget
