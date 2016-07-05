(function() {

  window.reload = function() {
    document.body.innerText = 'File hot reloaded at ' + new Date()
  }

  document.body.innerText = 'Refreshed at ' + new Date()

}())
