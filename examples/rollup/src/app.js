import reload from './component.js'

window.reload = reload

document.body.innerText = 'Refreshed at ' + new Date()
