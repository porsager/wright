# 🚀 Wright

#### Hot Module Reloading: at the *Virtual Machine* level

- Compatible with any framework (or no framework at all)
- Patches your JS, CSS and Static Assets on change without losing app state
- Uses the Chrome Debugger Protocol to replace the source files in the VM
- Convenient CLI/JS API for lightweight build systems / npm scripts
- Fallback to regular refresh in all other browsers

## Quick start

Wright was built to be able to plugin to various developer setups, and due to that it will have to be set up in many different ways. The quickest way to start is to open a terminal, cd to your project directory. 

Then start wright by pointing either to your main .html entry point
```
wright index.html
```

or a url if you already have a dev server.
```
wright http://localhost:3000
```

From there on you can add extra options to benefit from wrights complete functionality.

## Framework Support

Wright is framework agnostic because the code patching happens at the VM level.

Wright has been tested with many frameworks, and there are plenty of examples to help get you started.

Tested successfully with:

- [VanillaJs](https://github.com/porsager/Wright/tree/master/examples/simple)
- React
- [Mithril](https://github.com/porsager/Wright/tree/master/examples/mithril)
- [Rollup](https://github.com/porsager/Wright/tree/master/examples/rollup)
- [Browserify](https://github.com/porsager/Wright/tree/master/examples/mithril)
- Webpack
- [Stylus](https://github.com/porsager/Wright/tree/master/examples/mithril)
- postcss

And should also work awesomely with candylize, fragmentor, pistontulastic or anything else you can throw at it :thumbsup:

Currently works with Chrome, tested on OSX & Windows 10.

Wright automatically watches any resource (js, css, image, font) that is loaded in the browser, and hot reloads it when it changes.

## Getting started

Wright can start a server for you using a specified index.html file or a boilerplate html where your js & css will be injected into.

It can also take a url to an existing server and inject js & css in to that.

## CLI API
```
$ npm install -g wright
```
Using wright as a cli makes it easy to get started right away or to set up your project with npm scripts.

## Options
```
main              Specifies the entry point of your app. Point to a .html
                  file to start a server serving that at all directory paths.
                  If you already have you own server running specifiy the
                  full url like http://localhost:5000

Standard Options:

-r,  --run        Activates Hot module reloading. This will inject any changed
                  javascript files, and then run the function if supplied.
                  If this is not specified, changing javascript
                  files will cause a full refresh.

-s,  --serve      Specify which local directory that is being served.
                  Defaults to folder of main file or the current directory.

-w,  --watch      Any folder, file or file type to watch that should cause a
                  refresh of the browser. Use commas to add more.

     --js         

     --css
```

#### Example
```
$ wright dist/index.html -r "m.redraw"
```

## Javascript API

Using wright with javascript is great if you have some build steps or compilation that needs to happen before hot reloading js or css.
It also allows you to avoid touching the file system, thereby getting a quicker time to screen for your js & css changes.

```
$ npm install -D wright
```

Wright exports a function which takes the options used for launching.

```js
const wright = require('wright')

wright({
  // Main should specify the entry point of your app.
  //   .html   (eg. index.html)
  //   url     (eg. http://localhost:5000)
  //   defaults to using a boilerplate html file.
  main    : 'src/index.html',

  // Specify which directory to serve. This is the directory
  // where wright will watch the files loaded in the browser.
  // Defaults to root of main html file or CWD.
  serve   : String,       // Path to directory to serve
                          // Defaults to root of main
                          // html file or CWD.

  // Activates Hot module reloading. This will inject any
  // changed javascript files, and then run the global function
  // with the changed path as argument { path: 'file.js' }.
  run     : String,       // Global function to call on change

  // The JS property dynamically injects scripts without
  // touching the file system. You can add your build scripts
  // here to do their thing when your source changes.
  // Remember you just need to target chrome, so any build
  // steps including ES6>ES5 transpiling or minification is
  // unnecessary overhead.
  js      : {
    compile : Function,   // A function that returns a Promise
                          // resolving to the source code, or a
                          // function with a callback argument called
                          // in node style callback(err, code).
                          // * Required

    path    : String,     // Path to use as script src
                          // Defaults to wrightinjected.js

    watch   : String,     // Glob pattern used to watch files
                          // that should trigger compilation.
                          // Defaults to common js extensions
                          // '**/*.{js,ls,purs,ts,cljs,coffee,litcoffee,jsx}'
  },

  // The css property is also very useful to build and inject
  // css directly without touching the file system.
  css     : {
    compile : Function,   // A function that returns a Promise
                          // resolving to the source code, or a
                          // function with a callback argument called
                          // in node style callback(err, code).
                          // * Required

    path    : String,     // Path to use as script src
                          // Defaults to wrightinjected.js

    watch   : String,     // Glob pattern used to watch files
                          // that should trigger compilation.
                          // Defaults to common js extensions
                          // '**/*.{css,styl,less,sass}'
  },

  // Execute can be used to start another running process.
  // This can be a build command with watch capabilites like
  // `rollup -c --watch` or backend server api the app needs
  // to talk to.
  execute : String,        // A single or multiple commands

  // Watch is only to be used in case you want a quick way to force
  // a full browser refresh when some files change. This might be
  // useful in the case of a php server serving static html that
  // you want to see on file changes
  watch   : String        // Glob pattern
})
```

## Advanced

The cli or options object also takes the following more advanced options:

**port** (default 3000)
The port to serve from - Wright will use this as a starting point when probing for available ports.

**debug** (default false)
Set to true to receive debugging info in the console. If set to 2 output from chrome will also be shown.

**fps** (default false)
Activate the chrome fps gui widget

**jail** (default true)
This will jail variables in your script to stop chrome from dereferencing them while doing Hot module reloading. Defaults to true.
