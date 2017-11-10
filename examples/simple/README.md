# Simple example

To run this example you need to cd to this directory and have wright installed globally or use the npm run scripts.

To hot reload js you need to have a global function to call when you script changes. Hot reloading js works by injecting the new script to chrome, but since the page won't be refreshed no initialization will take place (which is exactly what we want). Instead there should be a global function available to run the newly injected script. Call it with the (-r --run) parameter like this
```
wright -r "redraw()" index.html
```

Now try to change background color in the style.css file or change the text in the javascript files. If you change the html file a full refresh will also be done.

You can also start wright with the app.js and style.css file directly like this
```
wright -r "redraw()" js/app.js css/style.css
```

When hot reloading javascript you need something in JS that can redraw your view from your apps state. This works very well with various Virtual DOM libraries.

## Virtual DOM examples

- [Mithril](https://github.com/porsager/wright/tree/master/examples/mithril)

### Coming soon
- React.js
- Cycle.js
