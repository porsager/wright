if (!('p' in window)) {
  window.p = function print(x) {
    if (Array.isArray(x) && Array.isArray(x.raw))
      return (...rest) => (window.p(x[0], ...rest), rest[0])

    window.console.log.apply(console, arguments)
    return x
  }
}
