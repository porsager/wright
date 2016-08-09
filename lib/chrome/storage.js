const config = require('../config')

module.exports = function(chrome) {

  chrome.storage = {

    all: function(session) {
      return new Promise((resolve, reject) => {
        chrome.send('DOMStorage.getDOMStorageItems', {
          storageId: {
            securityOrigin: config.url,
            isLocalStorage: !session
          }
        }, (err, result) => err ? reject(err) : resolve(result))
      })
    },

    get: function(key, session) {
      return chrome.store.all(key, session).then(r =>
        r.filter(i => i.key === key).map(i => i.value)[0]
      )
    },

    set: function(key, value, session) {
      return new Promise((resolve, reject) => {
        chrome.send('DOMStorage.setDOMStorageItems', {
          key: key,
          value: value,
          storageId: {
            securityOrigin: config.url,
            isLocalStorage: !session
          }
        }, (err, result) => err ? reject(err) : resolve(result))
      })
    },

    remove: function(key, session) {
      return new Promise((resolve, reject) => {
        chrome.send('DOMStorage.setDOMStorageItems', {
          key: key,
          storageId: {
            securityOrigin: config.url,
            isLocalStorage: !session
          }
        }, (err, result) => err ? reject(err) : resolve(result))
      })
    }
  }

  return chrome

}
