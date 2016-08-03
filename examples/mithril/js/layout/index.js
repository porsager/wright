import m from 'mithril'
import header from './header'
import sidebar from './sidebar'

export default function(page) {
  return {
    view: () => m('#app', [
      m('header', m(header)),
      m('aside', m(sidebar)),
      m('main', m(page))
    ])
  }
}
