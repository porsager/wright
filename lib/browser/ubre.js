import Pws from 'pws'
import Ubre from 'ubre'

const socket = new Pws('ws://' + location.host + '/wright')
    , ubre = Ubre.ws(socket)

ubre.subscribe('reload', () => !window.wright && location.reload())

let opened = false

socket.on('open', () => {
  opened && location.reload()
  opened = true
})

export default ubre
