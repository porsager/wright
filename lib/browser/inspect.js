import ubre from './ubre'
import m from 'mithril'
import b from 'bss'

const model = {
  show: false,
  get rect() {
    const rect = model.over.getBoundingClientRect()
    return rect && {
      tag: model.over.tagName.toLowerCase(),
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom
    }
  }
}

const locationRegex = /(.*)[ @(](.*):([\d]*):([\d]*)/i
function parseStackLine(string) {
  const [match, func, url, line, column] = (' ' + string.trim()).match(locationRegex) || []

  return match && {
    function: func.trim().replace(/^(global code|at) ?/, ''),
    url,
    line: parseInt(line),
    column: parseInt(column)
  }
}

window.addEventListener('click', function(e) {
  if (!model.show)
    return

  e.preventDefault()
  e.stopPropagation()

  let stack
  let el = e.target
  while (el.parentNode && !stack) {
    stack = el.stackTrace
    el = el.parentNode
  }
  if (stack) {
    model.show = false
    const parsed = stack.split('\n').map(parseStackLine).filter(a => a)
    if (parsed.length > 2 && parsed[2].url) {
      ubre.publish('goto', parsed[2])
      e.stopPropagation()
      e.preventDefault()
      m.redraw()
    }
  }
}, true)

window.addEventListener('mouseover', e => {
  model.over = e.target
  model.show && m.redraw()
})

window.addEventListener('keydown', e => {
  e.key === 'Shift' && (model.shift = true)
  e.key === 'Meta' && (model.meta = true)
  e.key === 'Control' && (model.control = true)
  update()
}, true)

window.addEventListener('keyup', e => {
  e.key === 'Shift' && (model.shift = false)
  e.key === 'Meta' && (model.meta = false)
  e.key === 'Control' && (model.control = false)
  update()
}, true)

window.addEventListener('blur', e => {
  model.show = false
  m.redraw()
})

function update() {
  const show = model.shift && (model.meta || model.control)
  if (model.show !== show) {
    model.show = show
    m.redraw()
  }
}

const div = document.createElement('div')
div.id = 'wright_inspect'
document.documentElement.appendChild(div)
m.mount(div, { view: () =>
  model.show && model.rect && m('div' + b`
    position fixed
    z-index 200000
    pointer-events none
    transition opacity 0.3s
    transform-origin ${ model.rect.left + model.rect.width / 2 }px ${ model.rect.top + model.rect.height / 2 }px
    l 0
    b 0
    r 0
    t 0
  `.$animate('0.3s', {
    from: b`
      o 0
      transform scale(2)
    `
  }), {
    onbeforeremove: ({ dom }) => new Promise(res => {
      dom.style.opacity = 0
      setTimeout(res, 300)
    })
  },
    m('span' + b`
      ff monospace
      fs 10
      zi 1
      p 2 4
      bc white
      position absolute
      white-space nowrap
      br 3
      bs 0 0 3px rgba(0,0,0,.5)
      t ${ model.rect.bottom + 8}
      l ${ model.rect.left }
    `.$animate('0.3s', { from: b`o 0` }),
      Math.round(model.rect.left) + ',' + Math.round(model.rect.top) + ' <' + model.rect.tag + '> ' + Math.round(model.rect.width) + 'x' + Math.round(model.rect.height)
    ),
    m('svg' + b`
      position absolute
      top 0
      left 0
    `, {
      width: '100%',
      height: '100%'
    },
      m('defs',
        m('mask#hole',
          m('rect', {
            width: 10000,
            height: 10000,
            fill: 'white'
          }),
          m('rect' + b`
            transition all 0.3s
          `, {
            fill: 'black',
            rx: 4,
            ry: 4,
            width: model.rect.width + 8,
            height: model.rect.height + 8,
            x: model.rect.left - 4,
            y: model.rect.top - 4
          })
        )
      ),
      m('rect', {
        fill: 'rgba(0, 150, 255, 0.5)',
        width: '100%',
        height: '100%',
        mask: 'url(#hole)'
      })
    )
  )
})
