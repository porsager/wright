(function() {
  document.oncontextmenu = e => {
    e.preventDefault()

    document.oncontextmenu = null

    const dialog = document.createElement('div')
        , root = dialog.createShadowRoot()
        , overlay = document.createElement('div')

    root.appendChild(overlay)

    overlay.style.cssText = `
      position: fixed;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${ Math.pow(2, 32) };
      width: 100%;
      height: 100%;
      font-family: 'Open Sans';
      background: rgba(0, 0, 0, 0.35);
      left: 0px;
      top: 0px;
      transition: opacity 0.4s;
    `

    const content = document.createElement('div')

    content.innerHTML = `
      <p>
        Opening developer tools will disconnect Wright.
        Use the window with the remote debugger instead
      </p>
    `

    content.style.cssText = `
      padding: 20px 40px;
      text-align: center;
      width: 50%;
      background: white;
      box-shadow: 0 20px 40px rgba(0,0,0,0.35);
      transform: translateY(0);
      box-sizing: border-box;
    `

    const button = document.createElement('button')

    button.tabIndex = 0
    button.style.cssText = `
      text-align: center;
      background: #888;
      color: white;
      padding: 8px 16px;
      min-width: 80px;
      border-radius: 2px;
      cursor: pointer;
      border: none;
      font-size: 16px;
    `

    button.innerHTML = 'OK'

    overlay.appendChild(content)
    content.appendChild(button)

    overlay.onclick = function(e) {
      if (e.target === this)
        overlay.remove()
    }

    button.onclick = () => overlay.remove()

    window.document.documentElement.appendChild(dialog)

    return false
  }
}())
