import m from 'mithril'
import l from './layout'
import login from './pages/login'
import intro from './pages/intro'
import js from './pages/js'
import css from './pages/css'

m.route.prefix('')

const layoutRoutes = {
  '/'     : intro,
  '/css'  : css,
  '/js'   : js,
  '/404'  : { view: () => m('h1', 'not found') }
}

const layout = {
  view: vnode => {
    return m(l, m(layoutRoutes[vnode.attrs.route]))
  }
}

const routes = {
  '/login'  : login,
  '/'       : layout,
  '/js'     : layout,
  '/css'    : layout,
  '/404'    : layout
}

export default routes
