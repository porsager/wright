import ubre from './ubre'
import m from 'mithril'
import b from 'bss'

const model = {
  show: false,
  inspectRect: null
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

  let stack
  let el = e.target
  while (el.parentNode && !stack) {
    stack = el.stackTrace
    el = el.parentNode
  }
  if (stack) {
    const parsed = stack.split('\n').map(parseStackLine).filter(a => a)
    if (parsed.length > 1 && parsed[1].url) {
      ubre.publish('goto', parsed[1])
      e.stopPropagation()
      e.preventDefault()
      m.redraw()
    }
  }
}, true)

window.addEventListener('mouseover', e => {
  const rect = e.target.getBoundingClientRect()
  model.inspectRect = rect && {
    tag: e.target.tagName.toLowerCase(),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom
  }
  m.redraw()
})

window.addEventListener('keypress', e => {
  if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
    model.show = !model.show
    m.redraw()
  }
})

const div = document.createElement('div')
div.id = 'wright_inspect'
document.documentElement.appendChild(div)
m.mount(div, { view: () =>
  model.show && model.inspectRect && m('div' + b`
    position absolute
    pointer-events none
    transition opacity 0.3s
    transform-origin ${ model.inspectRect.left + model.inspectRect.width / 2 }px ${ model.inspectRect.top + model.inspectRect.height / 2 }px
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
      t ${ model.inspectRect.bottom + 8}
      l ${ model.inspectRect.left }
    `.$animate('0.3s', { from: b`o 0` }),
      Math.round(model.inspectRect.left) + ',' + Math.round(model.inspectRect.top) + ' <' + model.inspectRect.tag + '> ' + Math.round(model.inspectRect.width) + 'x' + Math.round(model.inspectRect.height)
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
            width: model.inspectRect.width + 8,
            height: model.inspectRect.height + 8,
            x: model.inspectRect.left - 4,
            y: model.inspectRect.top - 4
          })
        )
      ),
      m('rect', {
        fill: 'rgba(0, 0, 0, 0.25)',
        width: '100%',
        height: '100%',
        mask: 'url(#hole)'
      })
    )
  )
})
