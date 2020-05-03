import Pws from 'pws'
import Ubre from 'ubre'

const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
    , socket = new Pws(protocol + '://' + location.host + '/wright')
    , ubre = Ubre.ws(socket)

ubre.subscribe('reload', () => !window.wright && location.reload())
ubre.subscribe('run', ({ method, arg }) => {
  const fn = method.split('.').reduce((acc, m) => acc[m] || {}, window)
  typeof fn === 'function'
    ? fn(arg)
    : ubre.publish('error', { message: 'Couldn\'t find window.' + method })
})

let opened = false

socket.addEventListener('open', () => {
  opened && location.reload()
  opened = true
})

export default ubre
