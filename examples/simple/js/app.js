(function() {

  var date = null
  var filename

  window.reload = function(payload) {
    filename = payload.path
    date = new Date()
  }

  setInterval(function() {
    if (date) {
      var seconds = parseFloat(Math.round((Date.now() - date.getTime()) / 100) / 10).toFixed(1)
      window.main.innerText = 'Hot reloaded ' + filename + ' ' + seconds + ' second' + (seconds === 1 ? '' : 's') + ' ago'
    }
  }, 100)

  window.main.innerText = 'Refreshed at ' + new Date()

}())
