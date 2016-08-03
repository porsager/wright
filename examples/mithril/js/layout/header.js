import login from '../models/login'

export default {
  view: () => [
    m('h2', 'header'),
    m('button', {
      onclick: login.logout
    }, 'logout')
  ]
}
