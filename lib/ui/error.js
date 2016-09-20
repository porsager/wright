(function() {
  let close

  window.wright.error = function(title, content) {
    if (close)
      close()

    if (!title)
      return

    const overlay = document.createElement('div')

    overlay.style.cssText = `
      position: fixed;
      z-index: ${ Math.pow(2, 32) - 2 };
      width: 100%;
      height: 100%;
      font-family: 'Open Sans';
      background: rgba(0, 0, 0, 0.35);
      left: 0px;
      top: 0px;
      transition: opacity 0.4s;
      opacity: 0;
    `

    const notification = document.createElement('notification')

    notification.style.cssText = `
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

    overlay.appendChild(notification)

    overlay.onclick = function(e) {
      if (e.currentTarget === this)
        close()
    }

    close = function() {
      notification.style.transform = 'translateY(-' + (notification.offsetHeight) + 'px)'
      overlay.style.opacity = 0
      overlay.addEventListener('transitionend', () => overlay.remove())
    }

    document.documentElement.appendChild(overlay)

    const header = document.createElement('h1')

    header.innerText = title
    header.style.marginTop = 0

    const pre = document.createElement('pre')

    pre.innerHTML = content
    pre.style.cssText = `
      border: 2px dashed #bbb;
      background: #eee;
      padding: 20px;
      max-height: 50vh;
      line-height: 1.5em;
      overflow: auto;
    `

    notification.appendChild(header)
    notification.appendChild(pre)

    notification.style.transform = 'translateY(-' + notification.offsetHeight + 'px)'

    window.requestAnimationFrame(() => {
      notification.style.transition = 'transform 0.3s'
      window.requestAnimationFrame(() => {
        overlay.style.opacity = 1
        notification.style.transform = 'translateY(0)'
      })
    })
  }
}())
