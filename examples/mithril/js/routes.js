import m from 'mithril'
import l from './layout.js'
import login from './pages/login.js'
import intro from './pages/intro.js'
import js from './pages/js.js'
import css from './pages/css.js'

m.route.prefix('')

const routes = {
  '/login'  : login,
  '/'       : l(intro),
  '/js'     : l(js),
  '/css'    : l(css),
  '/404'    : l({ view: () => m('h1', 'not found') })
}

export default routes
