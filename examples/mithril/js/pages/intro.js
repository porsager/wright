import m from 'mithril'

const heading = {
  view: vnode => m('h1', vnode.attrs.content )
}

const paragraph = {
  view: vnode => m('p', vnode.attrs.content )
}

export default {
  view: () => [
    m(heading, { content: 'Introduction' }),
    m(paragraph, { content: 'So while you\'re listening to that great song you should go ahead and edit the files inside examples/mithril' })
  ]
}
