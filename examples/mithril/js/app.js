import m from 'mithril'
import routes from './routes'
import login from './models/login'

window.m = m

if (!login.user) {
  if (window.location.pathname !== '/login')
    login.redirect = window.location.pathname + window.location.search
  window.history.pushState(null, null, '/login')
}

window.onload = () => {
  m.route(document.body, '/', routes)
}
