const menus = [
  { href: '/', title: 'home' },
  { href: '/about', title: 'about' },
  { href: '/users', title: 'users' }
]

export default {
  view: () => m('nav', menus.map(({ href, title }) =>
    m('a', { onclick: () => m.route.set(href) }, title)
  ))
}
