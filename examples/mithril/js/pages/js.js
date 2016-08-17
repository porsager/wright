import m from 'mithril'

export default {
  oninit: vnode => {
    vnode.state.start = Date.now()
    vnode.state.interval = setInterval(() => m.redraw(), 1000)
  },
  onremove: vnode => {
    clearInterval(vnode.state.interval)
  },
  view: vnode => [
    m('h1', 'js'),
    m('p', 'This example shows how keeping the state in the browser is possible while doing hot reloading of anything'),
    m('p', 'ms: ' + (Date.now() - vnode.state.start))
  ]
}
