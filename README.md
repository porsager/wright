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

- [VanillaJs](https://github.com/porsager/Wright/tree/master/examples/simple)
- React
- [Mithril](https://github.com/porsager/Wright/tree/master/examples/mithril)
- [Rollup](https://github.com/porsager/Wright/tree/master/examples/rollup)
- Browserify
- stylus
- postcss

And should also work awesomely with candylize, fragmentor, pistontulastic or anything else you can throw at it :thumbsup:

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
                  file use that. If you already have you own server running
                  just specifiy the full url like http://localhost:5000

Standard Options:

-r,  --run        Activates Hot module reloading. This will inject any changed
                  javascript files, and then run the script or js file
                  provided here.

-s,  --serve      Specify which directory that is being served.
                  Defaults to folder of main file or the current directory.

-w,  --watch      Any folder, file or file type to watch that should cause a
                  refresh of the browser. Use commas to add more.
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

Wright exports one function which takes an object containing options.

```
const wright = require('wright')

wright({

  main    : 'public/index.html',
  serve   : 'public',
  run     : 'm.redraw()'
  js      : {
    watch   : 'src/js/**/*.js',
    jail    : true,
    compile : () => rollup()
  },
  css     : {
    watch   : 'src/css/**/*.js',
    compile : () => stylus()
  },
  watch   : '**/*.php'
})
```

### Options


#### main [String]
Main should specify the entry point of your app. If you have an index.html file that would be it or if you have an app.js file use that. If you already have you own server running specifiy the full url like http://localhost:5000.
If you don't specify anything wright will use a boilerplate html file and expect you to use the js & css options for injecting your code.

#### serve [String]
Specify which directory to serve. This is the directory where wright will watch the files loaded in the browser.
Defaults to root of main html file or CWD.

#### run [String]
Activates Hot module reloading. This will inject any changed javascript files, and then run the script or js file provided here.

#### js [Object]
You can add your build scripts here to do their thing when your source changes.
Remember you just need to target chrome, so any build steps including ES6>ES5 transpiling or minification is unnecessary overhead.

name     | description
:--------|:-----
watch    | Directory, file, glob pattern or array of what to watch.
jail     | This will jail variables in your script to stop chrome from dereferencing them while doing Hot module reloading. Defaults to true.
compile  | A function returning a promise, that resolve to a compiled css string.

#### css
Any css preprocessing can be done here.

name     | description
:--------|:-----
watch    | Directory, file, glob pattern or array of what to watch.
compile  | A function returning a promise, that resolve to a compiled css string.

#### Watch
Directory, file, glob pattern or array of something to watch that should cause a browser refresh

## Advanced

The options object also takes the following more advanced properties:

**port** (default 3000)
The port to serve from

**debug** (default false)
Set to true to receive debugging info in the console, or to 2 to also receive chrome output

**fps** (default false)
Activate the chrome fps gui widget
