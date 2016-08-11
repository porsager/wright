(function() {

  var date = null

  window.reload = function() {
    date = new Date()
  }

  setInterval(function() {
    if (date) {
      var seconds = parseFloat(Math.round((Date.now() - date.getTime()) / 100) / 10).toFixed(1)
      window.main.innerText = 'Hot reloaded js ' + seconds + ' second' + (seconds === 1 ? '' : 's') + ' ago'
    }
  }, 100)

  window.main.innerText = 'Refreshed at ' + new Date()

}())
