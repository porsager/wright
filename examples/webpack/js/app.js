const reload = require('./component.js')
const styles = require('../css/style.css')

window.reload = reload

window.onload = function() {
  document.body.innerText = 'Refreshed at ' + new Date()
}
