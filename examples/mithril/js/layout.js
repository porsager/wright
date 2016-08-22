import m from 'mithril'

const layout = {
  view: (vnode) => {
    const menus = [
      { href: '/', title: 'intro' },
      { href: '/js', title: 'js' },
      { href: '/css', title: 'css' },
      { href: '/login', title: 'logout' }
    ]

    return [
      m('header', [
        m('iframe', {
          width: 420,
          height: 315,
          src: 'https://www.youtube.com/embed/oHg5SJYRHA0?html5=1&autoplay=1&showinfo=0&controls=0',
          frameborder: 0,
          allowfullscreen: true
        }),
        m('nav', menus.map(menu =>
          m('a', {
            href: menu.href,
            class: m.route.get() === menu.href ? 'active' : '',
            oncreate: m.route.link
          }, menu.title)
        ))
      ]),
      m('main', vnode.children)
    ]
  }
}

export default function(page) {
  return { render: () => m(layout, m(page)) }
}
