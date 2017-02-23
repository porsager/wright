import m from 'mithril'
import routes from './routes'
import login from './models/login'

window.m = m

let checkLogin = () => {
  if (!login.user) {
    console.warn('Unauthorized')
    if (window.location.pathname !== '/login')
      login.redirect = window.location.pathname + window.location.search
    window.history.pushState(null, null, '/login')
  }
}

window.onhashchange = () => checkLogin()

window.onload = () => {
  m.route(document.body, '/404', routes)
  checkLogin()
}
