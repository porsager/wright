const reload = module.exports

reload.images = filename => `
  document.querySelectorAll('img[src*="${filename}"]')
  .forEach(img => img.src = '${filename + '?' + Date.now()}')
`

reload.css = filename => `
  var link = document.querySelector('link[href*="${filename}"]')
  if (link) link.href = '${filename + '?' + Date.now()}'
`

// TODO make font reload (change css file with random characters after font-face urls)
reload.fonts = filename => `

`
