import m from 'mithril'
import login from '../models/login'

export default {
  oninit: ({ state }) => {
    state.username = ''
    state.password = ''
  },

  view: ({ state }) => [
    m('h1', 'Login'),
    m('p', login.error || 'Who are you?'),
    m('form', {
      onsubmit: e => {
        e.preventDefault()
        login.submit(state)
      }
    }, [
      m('input', {
        value: login.user || state.username,
        onchange: e => state.username = e.target.value
      }),
      m('input[type=password]', {
        onchange: e => state.password = e.target.value
      }),
      m('input[type=submit]')
    ])
  ]
}
