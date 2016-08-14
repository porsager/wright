import m from 'mithril'
import l from './layout'
import login from './pages/login'
import intro from './pages/intro'
import js from './pages/js'
import css from './pages/css'

m.route.prefix('')

const routes = {
  '/login'  : login,
  '/'       : l(intro),
  '/js'     : l(js),
  '/css'    : l(css)
}

export default routes
