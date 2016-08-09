import reload from './component.js'

window.reload = reload

window.onload = function() {
  document.body.innerText = 'Refreshed at ' + new Date()
}
