(function() {

  window.reload = function() {
    window.main.innerText = 'File hot reloaded at ' + new Date()
  }

  window.main.innerText = 'Refreshed at ' + new Date()

}())
