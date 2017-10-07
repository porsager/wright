(function() {
  window.wright.error = function(title, description) {
    const el = document.getElementById('wrighterror')

    if (el)
      el.parentNode.removeChild(el)

    if (!title)
      return

    const error = document.createElement('wrighterror')
        , root = error.createShadowRoot()
        , overlay = document.createElement('div')

    error.id = 'wrighterror'

    root.appendChild(overlay)

    overlay.style.cssText = `
      position: fixed;
      z-index: ${ Math.pow(2, 32) - 2 };
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.35);
      left: 0px;
      top: 0px;
      transition: opacity 0.4s;
      font-family: wrightopensans;
      opacity: 0;
    `

    const content = document.createElement('div')

    content.style.cssText = `
      position: fixed;
      top: 0;
      left: -40px;
      padding: 40px 80px;
      width: calc(100% + 80px);
      background: white;
      box-shadow: 0 20px 40px rgba(0,0,0,0.35);
      transform: translateY(0);
      box-sizing: border-box;
    `

    overlay.appendChild(content)

    overlay.onclick = function(e) {
      if (e.target === this)
        close()
    }

    function close() {
      content.style.transform = 'translateY(-' + (content.offsetHeight) + 'px)'
      overlay.style.opacity = 0
      overlay.addEventListener('transitionend', () => error.remove())
    }

    document.documentElement.appendChild(error)

    const header = document.createElement('h1')

    header.innerText = title
    header.style.cssText = `
      margin-top: 0;
    `

    const pre = document.createElement('pre')

    pre.innerHTML = description
    pre.style.cssText = `
      border: 2px dashed #bbb;
      background: #eee;
      padding: 20px;
      max-height: 50vh;
      line-height: 1.5em;
      overflow: auto;
    `

    content.appendChild(header)
    content.appendChild(pre)

    content.style.transform = 'translateY(-' + content.offsetHeight + 'px)'

    window.requestAnimationFrame(() => {
      content.style.transition = 'transform 0.3s'
      window.requestAnimationFrame(() => {
        overlay.style.opacity = 1
        content.style.transform = 'translateY(0)'
      })
    })
  }
}())
