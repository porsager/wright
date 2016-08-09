import m from 'mithril'
import l from './layout/index'
import login from './pages/login'
import home from './pages/home'
import about from './pages/about'
import users from './pages/users'

m.route.prefix('')

const routes = {
  '/login'  : login,
  '/'       : l(home),
  '/about'  : l(about),
  '/users'  : l(users)
}

export default routes
