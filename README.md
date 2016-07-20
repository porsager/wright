# Wright

Hot reloading of js, css and static assets with fallback to regular refresh.
Use it with your own choice of frameworks or libraries like react, mithril, rollup, browserify, candylize, fragmentor or pistontulastic.

Currently works with Chrome, tested on OSX & Windows 10.

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

-w,  --watch      Specify which directory to watch
                  Defaults to root of main file / CWD

-s,  --serve      Specify which directory to serve
                  Defaults to root of main html file or CWD
```
#### Example with all options
```
$ wright public/app.js -s public -w src -r "m.redraw()"
```

## Javascript API

Using wright with javascript is great if you have some build steps or concatenation that needs to happen before running in the browser or to generate the javascript or styles to hot reload.

```
$ npm install -D wright
```

Wright exports one function which takes an options object and returns a promise that resolves with a browser object when everything is launched and ready for action.

```
const wright = require('wright')

wright({}).then(browser => {})
```

### browser methods

#### .refresh()
A simple full refresh of the browser.

#### .inject(source)


## Examples

- Mithril
- React
- Vanilla

## Advanced

The options object also takes the following more advanced properties:

**host** (default 'localhost')
The host for where to serve from

**port** (default '3000')
The port to serve from

**debug** (default false)
Set to true to receive debugging info in the console

**fps** (default false)
Activate the chrome fps gui widget
