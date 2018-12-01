if (!('p' in window)) {
  window.p = function(first) {
    console.log.apply(console, arguments)
    return first
  }
}
