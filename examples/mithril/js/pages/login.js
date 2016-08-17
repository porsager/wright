import m from 'mithril'
import login from '../models/login'

export default {
  oninit: ({ state }) => {
    state.username = login.user || ''
    state.password = login.password || ''
  },

  view: ({ state }) => m('form#login', [
    m('h1', 'Login'),
    m('p', login.error || 'Try using test/test'),
    m('form', {
      onsubmit: e => {
        e.preventDefault()
        login.submit(state)
      }
    }, [
      m('input', {
        value: login.user || state.username,
        placeholder: 'username',
        onchange: e => state.username = e.target.value
      }),
      m('input[type=password]', {
        placeholder: 'password',
        onchange: e => state.password = e.target.value
      }),
      m('input[type=submit]')
    ])
  ])
}
