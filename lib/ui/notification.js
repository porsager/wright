(function() {

  const times = new Map()
      , files = new Map()
      , notifications = new Map()
      , container = document.createElement('notifications')
      , root = container.createShadowRoot()
      , ul = document.createElement('ul')

  ul.style.cssText = `
    position: fixed;
    margin: 0;
    top: 0;
    right: 0;
    padding: 10px;
    list-style: none;
    width: 360px;
    z-index: ${ Math.pow(2, 32) - 1 };
    font-family: wrightopensans;
    box-sizing: border-box;
  `

  root.appendChild(ul)

  window.wright.notification = function(id, title, content) {
    if (notifications.size === 0)
      document.documentElement.appendChild(container)

    remove(files.get(content))

    times.set(id, Date.now())

    const n = document.createElement('li')

    n.id = id
    files.set(content, n)

    n.style.cssText = `
      background: white;
      margin-bottom: 10px;
      list-style: none;
      box-sizing: border-box;
      box-shadow: 0 5px 20px rgba(0,0,0,0.35);
      overflow: hidden;
      cursor: pointer;
    `

    const header = document.createElement('h1')

    header.innerText = title.replace(/\\/, '\\')
    header.style.cssText = `
      margin: 10px 60px 4px 16px;
      font-size: 12px;
      text-transform: uppercase;
      color: #777;
    `

    const subheading = document.createElement('h2')

    subheading.innerText = content
    subheading.style.cssText = `
      font-size: 16px;
      margin: 4px 60px 10px 16px;
      color: #333;
    `

    const spinner = document.createElement('div')
    const time = document.createElement('div')

    spinner.style.cssText = time.style.cssText = `
      position: absolute;
      right: 10px;
      top: 50%;
      margin-top: -20px;
      font-size: 12px;
      line-height: 40px;
      text-transform: uppercase;
      font-weight: bold;
      transition: all 0.3s;
    `

    spinner.innerHTML = `
      <svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="40px" height="40px" viewBox="0 0 40 40" enable-background="new 0 0 40 40" xml:space="preserve">
        <path opacity="0.2" fill="#000" d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z"/>
        <path fill="#000" d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0C22.32,8.481,24.301,9.057,26.013,10.047z">
          <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.5s" repeatCount="indefinite"/>
        </path>
      </svg>
    `

    time.style.opacity = 0

    n.appendChild(header)
    n.appendChild(subheading)
    n.appendChild(spinner)
    n.appendChild(time)

    n.onclick = function() {
      remove(n)
    }

    ul.appendChild(n)
    notifications.set(id, n)

    n.style.transform = 'translateY(' + (-n.offsetHeight * ul.childNodes.length) + 'px)'
    n.style.opacity = 0

    window.requestAnimationFrame(() => {
      n.style.maxHeight = n.offsetHeight + 'px'
      n.style.transition = 'all 0.3s'
      window.requestAnimationFrame(() => {
        n.style.transform = 'translateY(0)'
        n.style.opacity = 1
      })
    })
  }

  window.wright.notification.done = function(id) {
    const n = notifications.get(id)

    if (!n)
      return

    n.firstChild.innerText += ' done'
    n.lastChild.innerText = (Date.now() - times.get(id)) + 'ms'
    n.lastChild.style.opacity = 1
    n.childNodes[2].style.opacity = 0
    setTimeout(() => {
      if (n.id === id)
        remove(n)
    }, 2500)
  }

  window.wright.notification.close = function(id) {
    remove(notifications.get(id))
  }

  function remove(n) {
    if (!n || n.removing)
      return

    times.delete(n.id)
    files.delete(n.childNodes[1].innerText)
    notifications.delete(n.id)
    n.removing = true
    n.style.opacity = 0
    n.style.maxHeight = 0
    n.style.marginBottom = 0
    n.addEventListener('transitionend', () => {
      n.remove()

      if (notifications.size === 0)
        container.remove()
    })
  }

}())
