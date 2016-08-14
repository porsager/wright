import m from 'mithril'

const login = {
  user: '',
  redirect: '/',
  logout: () => {
    login.user = null
    login.redirect = '/'
    m.route.set('/login')
  },
  submit: ({ username, password }) => {
    login.user = username === 'test' && password === 'test' && username
    login.error = !login.user && 'Wrong login - Try test/test'

    if (login.user)
      m.route.set(login.redirect)
  }
}

export default login
