import login from '../models/login'
import m from 'mithril'

export default {
  view: () => [
    m('h2', 'This is indeed in the header', [
      m('button', {
        onclick: login.logout
      }, 'logout')
    ])
  ]
}
