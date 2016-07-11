# Simple example

For hot reloading when css changes and a full refresh when js changes run:
```
wright index.html
```

If you want to hot reload js you can call it with a run function like this
```
wright -r "redraw()" index.html
```

Now try to change background color in the style.css file or change the text in the javascript files. If you change the html file a full refresh will also be done.

You can also start wright with the app.js file directly like this
```
wright -r "redraw()" js/app.js
```

When hot reloading javascript you need something in JS that can redraw your view from your apps state. This works very nicely with various Virtual DOM libraries.

## Virtual DOM examples

[Mithril](https://github.com/porsager/wright/examples/mithril)

[React](https://github.com/porsager/wright/examples/react)

[Cycle](https://github.com/porsager/wright/examples/cycle)
