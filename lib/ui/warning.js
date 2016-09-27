(function() {
  document.addEventListener('contextmenu', e => {
    window.alert('Opening developer tools will disconnect Wright.\\n\\nUse the window with the remote debugger instead')
    e.preventDefault()
    document.oncontextmenu = null
    return false
  })
}())
