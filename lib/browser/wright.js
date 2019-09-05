(function () {
  'use strict';

  if (!('p' in window)) {
    window.p = function print(x) {
      if (Array.isArray(x) && Array.isArray(x.raw))
        { return function () {
          var rest = [], len = arguments.length;
          while ( len-- ) rest[ len ] = arguments[ len ];

          return (window.p.apply(window, [ x[0] ].concat( rest )), rest[0]);
          } }

      window.console.log.apply(console, arguments);
      return x
    };
  }

  function index(url, protocols, WebSocket, options) {
    if (typeof protocols === 'function') {
      if (typeof WebSocket === 'object')
        { options = WebSocket; }
      WebSocket = protocols;
      protocols = undefined;
    }

    if (!Array.isArray(protocols) && typeof protocols === 'object') {
      options = protocols;
      protocols = undefined;
    }

    if (typeof WebSocket === 'object') {
      options = WebSocket;
      WebSocket = undefined;
    }

    if (!WebSocket) {
      if (typeof window !== 'undefined') {
        WebSocket = window.WebSocket;
        typeof window !== 'undefined'
          && typeof window.addEventListener === 'function'
          && window.addEventListener('online', connect);
      }
    }

    if (!WebSocket)
      { throw new Error('Please supply a websocket library to use') }

    if (!options)
      { options = {}; }

    var connection = null
      , reconnecting = false
      , reconnectTimer = null
      , heartbeatTimer = null
      , binaryType = null
      , lastOpen = null
      , reconnectDelay;

    var listeners = {};
    var listenerHandlers = {};
    var ons = {};
    var onHandlers = {};

    var pws = {
      CONNECTING: 'CONNECTING' in WebSocket ? WebSocket.CONNECTING : 0,
      OPEN: 'OPEN' in WebSocket ? WebSocket.OPEN : 1,
      CLOSING: 'CLOSING' in WebSocket ? WebSocket.CLOSING : 2,
      CLOSED: 'CLOSED' in WebSocket ? WebSocket.CLOSED : 3,
      get readyState() { return connection.readyState },
      get protocol() { return connection.protocol },
      get extensions() { return connection.extensions },
      get bufferedAmount() { return connection.bufferedAmount },
      get binaryType() { return connection.binaryType },
      set binaryType(type) {
        binaryType = type;
        connection.binaryType = type;
      },
      connect: connect,
      url: url,
      retries: 0,
      pingTimeout: 'pingTimeout' in options ? options.pingTimeout : false,
      maxTimeout: options.maxTimeout || 5 * 60 * 1000,
      maxRetries: options.maxRetries || 0,
      nextReconnectDelay: options.nextReconnectDelay || function reconnectTimeout(retries) {
        return Math.min((1 + Math.random()) * Math.pow(1.5, retries) * 1000, pws.maxTimeout)
      },
      send: function() {
        connection.send.apply(connection, arguments);
      },
      close: function() {
        clearTimeout(reconnectTimer);
        connection.close.apply(connection, arguments);
      },
      onopen: options.onopen,
      onmessage: options.onmessage,
      onclose:  options.onclose,
      onerror: options.onerror
    };

    var on = function (method, events, handlers) { return function (event, fn, options) {
      function handler(e) {
        options && options.once && connection[method === 'on' ? 'off' : 'removeEventListener'](event, handler);
        e && typeof e === 'object' && reconnectDelay && (e.reconnectDelay = reconnectDelay);
        fn.apply(pws, arguments);
      }

      event in events ? events[event].push(fn) : (events[event] = [fn]);
      event in handlers ? handlers[event].push(handler) : (handlers[event] = [handler]);
      connection && connection[method](event, handler);
    }; };

    var off = function (method, events, handlers) { return function (event, fn) {
      var index = events[event].indexOf(fn);
      if (index === -1)
        { return }

      connection && connection[method](event, handlers[event][index]);

      events[event].splice(index, 1);
      handlers[event].splice(index, 1);
    }; };

    pws.addEventListener = on('addEventListener', listeners, listenerHandlers);
    pws.removeEventListener = off('removeEventListener', listeners, listenerHandlers);
    pws.on = on('on', ons, onHandlers);
    pws.off = off('off', ons, onHandlers);
    pws.once = function (event, fn) { return pws.on(event, fn, { once: true }); };

    if (url)
      { connect(); }

    return pws

    function connect(url) {
      clearTimeout(reconnectTimer);

      if (typeof url === 'string')
        { pws.url = url; }

      if (connection && connection.readyState !== 3)
        { return close(4665, 'Manual connect initiated') }

      reconnecting = false;

      connection = new WebSocket(typeof pws.url === 'function' ? pws.url(pws) : pws.url, protocols, options);
      connection.onclose = onclose;
      connection.onerror = onerror;
      connection.onopen = onopen;
      connection.onmessage = onmessage;
      Object.keys(listenerHandlers).forEach(function (event) {
        listenerHandlers[event].forEach(function (handler) { return connection.addEventListener(event, handler); });
      });
      Object.keys(onHandlers).forEach(function (event) {
        onHandlers[event].forEach(function (handler) { return connection.on(event, handler); });
      });

      if (binaryType)
        { connection.binaryType = binaryType; }
    }

    function onclose(event, emit) {
      clearTimeout(heartbeatTimer);
      event.reconnectDelay = Math.ceil(reconnect());
      pws.onclose && pws.onclose.apply(pws, arguments);
    }

    function onerror(event) {
      if (!event)
        { event = new Error('UnknownError'); }

      event.reconnectDelay = Math.ceil(reconnect());
      pws.onerror && pws.onerror.apply(pws, arguments);
    }

    function onopen(event) {
      pws.onopen && pws.onopen.apply(pws, arguments);
      heartbeat();
      lastOpen = Date.now();
    }

    function onmessage(event) {
      pws.onmessage && pws.onmessage.apply(pws, arguments);
      heartbeat();
    }

    function heartbeat() {
      if (!pws.pingTimeout)
        { return }

      clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(timedOut, pws.pingTimeout);
    }

    function timedOut() {
      close(4663, 'No heartbeat received within ' + pws.pingTimeout + 'ms');
    }

    function reconnect() {
      if (reconnecting)
        { return reconnectDelay - (Date.now() - reconnecting) }

      reconnecting = Date.now();
      pws.retries = lastOpen && Date.now() - lastOpen > reconnectDelay
        ? 1
        : pws.retries + 1;

      if (pws.maxRetries && pws.retries >= pws.maxRetries)
        { return }

      reconnectDelay = pws.nextReconnectDelay(pws.retries);
      reconnectTimer = setTimeout(connect, reconnectDelay);

      return reconnectDelay
    }

    function close(code, reason) {
      setTimeout(clean, 0, connection);

      var event = closeEvent(code, reason);
      onclose(event);
      listenerHandlers.close && listenerHandlers.close.forEach(function (handler) { return handler(event); });
      onHandlers.close && onHandlers.close.forEach(function (handler) { return handler(code, reason, reconnectDelay); });
    }

    function clean(connection) {
      connection.onclose = connection.onopen = connection.onerror = connection.onmessage = null;
      Object.keys(listenerHandlers).forEach(function (event) {
        listenerHandlers[event].forEach(function (handler) { return connection.removeEventListener(event, handler); });
      });
      Object.keys(onHandlers).forEach(function (event) {
        onHandlers[event].forEach(function (handler) { return connection.off(event, handler); });
      });
      connection.close();
    }

    function closeEvent(code, reason) {
      var event;

      if (typeof window !== 'undefined' && window.CloseEvent) {
        event = new window.CloseEvent('HeartbeatTimeout', { wasClean: true, code: code, reason: reason });
      } else {
        event = new Error('HeartbeatTimeout');
        event.code = code;
        event.reason = reason;
      }

      return event
    }
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var rngBrowser = createCommonjsModule(function (module) {
  // Unique ID creation requires a high quality random # generator.  In the
  // browser this is a little complicated due to unknown quality of Math.random()
  // and inconsistent support for the `crypto` API.  We do the best we can via
  // feature-detection

  // getRandomValues needs to be invoked in a context where "this" is a Crypto
  // implementation. Also, find the complete implementation of crypto on IE11.
  var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                        (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

  if (getRandomValues) {
    // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
    var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

    module.exports = function whatwgRNG() {
      getRandomValues(rnds8);
      return rnds8;
    };
  } else {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var rnds = new Array(16);

    module.exports = function mathRNG() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) { r = Math.random() * 0x100000000; }
        rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return rnds;
    };
  }
  });

  /**
   * Convert array of 16 byte values to UUID string format of the form:
   * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */
  var byteToHex = [];
  for (var i = 0; i < 256; ++i) {
    byteToHex[i] = (i + 0x100).toString(16).substr(1);
  }

  function bytesToUuid(buf, offset) {
    var i = offset || 0;
    var bth = byteToHex;
    // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
    return ([bth[buf[i++]], bth[buf[i++]], 
  	bth[buf[i++]], bth[buf[i++]], '-',
  	bth[buf[i++]], bth[buf[i++]], '-',
  	bth[buf[i++]], bth[buf[i++]], '-',
  	bth[buf[i++]], bth[buf[i++]], '-',
  	bth[buf[i++]], bth[buf[i++]],
  	bth[buf[i++]], bth[buf[i++]],
  	bth[buf[i++]], bth[buf[i++]]]).join('');
  }

  var bytesToUuid_1 = bytesToUuid;

  function v4(options, buf, offset) {
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options === 'binary' ? new Array(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || rngBrowser)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ++ii) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || bytesToUuid_1(rnds);
  }

  var v4_1 = v4;

  var noop = function () { /* noop */ };

  function Ubre(ref) {
    var send = ref.send; if ( send === void 0 ) { send = noop; }
    var open = ref.open; if ( open === void 0 ) { open = false; }
    var deserialize = ref.deserialize; if ( deserialize === void 0 ) { deserialize = JSON.parse; }
    var serialize = ref.serialize; if ( serialize === void 0 ) { serialize = JSON.stringify; }
    var unwrapError = ref.unwrapError; if ( unwrapError === void 0 ) { unwrapError = unwrapErr; }

    var subscriptions = MapSet()
        , subscribers = MapSet()
        , tasks = new Map()
        , requests = new Map()
        , publishes = new Map()
        , handlers = new Map();

    var incoming = {
      subscribe: function(from, ref) {
        var subscribe = ref.subscribe;

        !subscribers.has(subscribe) && ubre.onTopicStart(subscribe);
        subscribers.add(subscribe, from);
        ubre.onSubscribe(subscribe, from);
      },

      unsubscribe: function(from, ref) {
        var unsubscribe = ref.unsubscribe;

        subscribers.remove(unsubscribe, from);
        !subscribers.has(unsubscribe) && ubre.onTopicEnd(unsubscribe);
        ubre.onUnsubscribe(unsubscribe, from);
      },

      publish: function (from, ref) {
          var publish = ref.publish;
          var body = ref.body;

          return subscriptions.has(publish) && subscriptions.get(publish).forEach(function (s) { return (
          (!s.target || s.target === from) && s.fn(body, from)
        ); });
    },

      request: function (from, ref) {
        var id = ref.id;
        var request = ref.request;
        var body = ref.body;

        if (!handlers.has(request))
          { return forward({ fail: id, body: 'NotFound' }, from) }

        tasks.set(id, { from: from });
        new Promise(function (resolve) { return resolve(handlers.get(request)(body, from)); })
        .then(function (body) { return sendResponse(id, { success: id, body: body }); })
        .catch(function (body) { return sendResponse(id, { fail: id, body: unwrapError(body) }); });
      },

      success: function (from, ref) {
        var success = ref.success;
        var body = ref.body;

        requests.has(success) && requests.get(success).resolve(body);
        requests.delete(success);
      },

      fail: function (from, ref) {
        var fail = ref.fail;
        var body = ref.body;

        requests.has(fail) && requests.get(fail).reject(body);
        requests.delete(fail);
      }
    };

    function sendResponse(id, message) {
      var task = tasks.get(id);
      if (!task)
        { return }

      if (open) {
        forward(message, task.from),
        tasks.delete(id);
      } else {
        task.message = message;
      }
    }

    function forward(message, target) {
      send(serialize(message), target);
    }

    function ubre(target) {
      return Object.create(ubre, {
        target: {
          writable: false,
          configurable: false,
          value: target
        }
      })
    }

    ubre.onTopicStart = noop;
    ubre.onTopicEnd = noop;
    ubre.onSubscribe = noop;
    ubre.onUnsubscribe = noop;

    ubre.message = function (message, from) {
      message = deserialize(message);
      message.subscribe && incoming.subscribe(from, message);
      message.unsubscribe && incoming.unsubscribe(from, message);
      message.publish && incoming.publish(from, message);
      message.request && message.id && incoming.request(from, message);
      message.success && incoming.success(from, message);
      message.fail && incoming.fail(from, message);
    };

    ubre.publish = function(topic, body) {
      subscribers.has(topic) && (this.target
        ? subscribers.get(topic).has(this.target) && forward({ publish: topic, body: body }, this.target)
        : subscribers.get(topic).forEach(function (s) { return open
          ? forward({ publish: topic, body: body }, s)
          : publishes.set({ publish: topic, body: body }, s); }
        )
      );
    };

    ubre.subscribe = function(topic, body, fn) {
      var this$1 = this;

      if (arguments.length === 2) {
        fn = body;
        body = undefined;
      }

      open && forward({ subscribe: topic, body: body }, this.target);
      var subscription = { body: body, fn: fn, sent: open, target: this.target };
      subscriptions.add(topic, subscription);

      return {
        unsubscribe: function () {
          open && forward({ unsubscribe: topic, body: body }, this$1.target);
          subscriptions.remove(topic, subscription);
        }
      }
    };

    ubre.request = function(request, body, id) {
      var this$1 = this;

      id = id || v4_1();
      return new Promise(function (resolve, reject) {
        try {
          open && forward({ request: request, id: id, body: body }, this$1.target);
          requests.set(id, { resolve: resolve, reject: reject, request: request, body: body, sent: open, target: this$1.target });
        } catch (err) {
          reject(err);
        }
      })
    };

    ubre.handle = function (request, fn) {
      typeof request === 'object'
        ? Object.keys(request).forEach(function (h) { return ubre.handle(h, request[h]); })
        : handlers.set(request, fn);
    };

    ubre.open = function (target) {
      open = true;

      subscriptions.forEach(function (s, topic) { return s.forEach(function (m) { return !m.sent && (
        forward({ subscribe: topic, body: m.body }, m.target),
        m.sent = true
      ); }); });

      requests.forEach(function (r, id) { return !r.sent && (
        forward({ request: r.request, id: id, body: r.body }, r.target),
        r.sent = true
      ); });

      tasks.forEach(function (message, id) { return sendResponse(id, message); }
      );

      publishes.forEach(function (target, p) {
        forward(p, target);
        publishes.delete(p);
      });
    };

    ubre.close = function() {
      var this$1 = this;

      if (this.target) {
        subscribers.removeItems(this.target);
        subscriptions.forEach(function (s, topic) { return s.forEach(function (ref) {
            var target = ref.target;

            return target === this$1.target && s.delete(target);
          }
        ); });
        requests.forEach(function (r, id) { return r.target === this$1.target && (
          r.reject(new Error('closed')),
          requests.delete(id)
        ); });
        tasks.forEach(function (target, id) { target === this$1.target && tasks.delete(id); });
      } else {
        open = false;
        subscriptions.forEach(function (s) { return s.forEach(function (m) { return m.sent = false; }); });
      }
    };

    return ubre
  }

  function MapSet() {
    var map = new Map();

    return {
      add: function (key, item) { return (map.get(key) || map.set(key, new Set()).get(key)).add(item); },
      has: map.has.bind(map),
      get: map.get.bind(map),
      delete: map.delete.bind(map),
      clear: map.clear.bind(map),
      forEach: map.forEach.bind(map),
      removeItems: function (item) { return map.forEach(function (set) { return set.delete(item); }); },
      remove: function (key, item) {
        var set = map.get(key);
        set && set.delete(item);
        set.size === 0 && map.delete(key);
      }
    }
  }

  function copy(o, seen) {
    if ( seen === void 0 ) { seen = []; }

    return Object.keys(o).reduce(function (acc, key) { return (
      acc[key] = o[key] && typeof o[key] === 'object'
        ? (
          seen.push(o),
          seen.indexOf(o[key]) > -1
            ? '[Circular]'
            : copy(o[key], seen))
        : o[key],
      acc
    ); }, Array.isArray(o) ? [] : {})
  }

  var common = ['name', 'message', 'stack', 'code'];
  function unwrapErr(error) {
    if (typeof error === 'function')
      { return '[Function: ' + (error.name || 'anonymous') + ']' }

    if (typeof error !== 'object')
      { return error }

    var err = copy(error);
    common.forEach(function (c) { return typeof error[c] === 'string' && (err[c] = error[c]); }
    );
    return err
  }

  function client(ws, options) {
    options = options || {};
    if (typeof options.send !== 'function')
      { options.send = function (message) { return ws.send(message); }; }

    var ubre = Ubre(options);

    ws.addEventListener('message', function (e) { return e.data && e.data[0] === '{' && ubre.message(e.data, ws); });
    ws.addEventListener('open', function () { return ubre.open(); });
    ws.addEventListener('close', function () { return ubre.close(); });

    ubre.ws = ws;

    return ubre
  }

  function server(server, options) {
    options = options || {};
    if (typeof options.send !== 'function')
      { options.send = function (message, ws) { return ws.send(message); }; }

    if (!('open' in options))
      { options.open = true; }

    var ubre = Ubre(options);
    ubre.wss = server;
    server.on('connection', function (ws) {
      ws.on('message', function (data) { return data[0] === '{' && ubre.message(data, ws); });
      ws.on('close', function () { return ubre(ws).close(); });
    });

    return ubre
  }

  Ubre.ws = client;
  Ubre.wss = server;

  var protocol = location.protocol === 'https:' ? 'wss' : 'ws'
      , socket = new index(protocol + '://' + location.host + '/wright')
      , ubre = Ubre.ws(socket);

  ubre.subscribe('reload', function () { return !window.wright && location.reload(); });
  ubre.subscribe('run', function (ref) {
    var method = ref.method;
    var arg = ref.arg;

    var fn = method.split('.').reduce(function (acc, m) { return acc[m] || {}; }, window);
    typeof fn === 'function'
      ? fn(arg)
      : ubre.publish('error', { message: 'Couldn\'t find window.' + method });
  });

  var opened = false;

  socket.addEventListener('open', function () {
    opened && location.reload();
    opened = true;
  });

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule$1(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var mithril = createCommonjsModule$1(function (module) {
  (function() {
  function Vnode(tag, key, attrs0, children, text, dom) {
  	return {tag: tag, key: key, attrs: attrs0, children: children, text: text, dom: dom, domSize: undefined, state: undefined, _state: undefined, events: undefined, instance: undefined, skip: false}
  }
  Vnode.normalize = function(node) {
  	if (Array.isArray(node)) { return Vnode("[", undefined, undefined, Vnode.normalizeChildren(node), undefined, undefined) }
  	if (node != null && typeof node !== "object") { return Vnode("#", undefined, undefined, node === false ? "" : node, undefined, undefined) }
  	return node
  };
  Vnode.normalizeChildren = function normalizeChildren(children) {
  	for (var i = 0; i < children.length; i++) {
  		children[i] = Vnode.normalize(children[i]);
  	}
  	return children
  };
  var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g;
  var selectorCache = {};
  var hasOwn = {}.hasOwnProperty;
  function isEmpty(object) {
  	for (var key in object) { if (hasOwn.call(object, key)) { return false } }
  	return true
  }
  function compileSelector(selector) {
  	var match, tag = "div", classes = [], attrs = {};
  	while (match = selectorParser.exec(selector)) {
  		var type = match[1], value = match[2];
  		if (type === "" && value !== "") { tag = value; }
  		else if (type === "#") { attrs.id = value; }
  		else if (type === ".") { classes.push(value); }
  		else if (match[3][0] === "[") {
  			var attrValue = match[6];
  			if (attrValue) { attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\"); }
  			if (match[4] === "class") { classes.push(attrValue); }
  			else { attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true; }
  		}
  	}
  	if (classes.length > 0) { attrs.className = classes.join(" "); }
  	return selectorCache[selector] = {tag: tag, attrs: attrs}
  }
  function execSelector(state, attrs, children) {
  	var hasAttrs = false, childList, text;
  	var className = attrs.className || attrs.class;
  	if (!isEmpty(state.attrs) && !isEmpty(attrs)) {
  		var newAttrs = {};
  		for(var key in attrs) {
  			if (hasOwn.call(attrs, key)) {
  				newAttrs[key] = attrs[key];
  			}
  		}
  		attrs = newAttrs;
  	}
  	for (var key in state.attrs) {
  		if (hasOwn.call(state.attrs, key)) {
  			attrs[key] = state.attrs[key];
  		}
  	}
  	if (className !== undefined) {
  		if (attrs.class !== undefined) {
  			attrs.class = undefined;
  			attrs.className = className;
  		}
  		if (state.attrs.className != null) {
  			attrs.className = state.attrs.className + " " + className;
  		}
  	}
  	for (var key in attrs) {
  		if (hasOwn.call(attrs, key) && key !== "key") {
  			hasAttrs = true;
  			break
  		}
  	}
  	if (Array.isArray(children) && children.length === 1 && children[0] != null && children[0].tag === "#") {
  		text = children[0].children;
  	} else {
  		childList = children;
  	}
  	return Vnode(state.tag, attrs.key, hasAttrs ? attrs : undefined, childList, text)
  }
  function hyperscript(selector) {
  	var arguments$1 = arguments;

  	// Because sloppy mode sucks
  	var attrs = arguments[1], start = 2, children;
  	if (selector == null || typeof selector !== "string" && typeof selector !== "function" && typeof selector.view !== "function") {
  		throw Error("The selector must be either a string or a component.");
  	}
  	if (typeof selector === "string") {
  		var cached = selectorCache[selector] || compileSelector(selector);
  	}
  	if (attrs == null) {
  		attrs = {};
  	} else if (typeof attrs !== "object" || attrs.tag != null || Array.isArray(attrs)) {
  		attrs = {};
  		start = 1;
  	}
  	if (arguments.length === start + 1) {
  		children = arguments[start];
  		if (!Array.isArray(children)) { children = [children]; }
  	} else {
  		children = [];
  		while (start < arguments.length) { children.push(arguments$1[start++]); }
  	}
  	var normalized = Vnode.normalizeChildren(children);
  	if (typeof selector === "string") {
  		return execSelector(cached, attrs, normalized)
  	} else {
  		return Vnode(selector, attrs.key, attrs, normalized)
  	}
  }
  hyperscript.trust = function(html) {
  	if (html == null) { html = ""; }
  	return Vnode("<", undefined, undefined, html, undefined, undefined)
  };
  hyperscript.fragment = function(attrs1, children) {
  	return Vnode("[", attrs1.key, attrs1, Vnode.normalizeChildren(children), undefined, undefined)
  };
  var m = hyperscript;
  /** @constructor */
  var PromisePolyfill = function(executor) {
  	if (!(this instanceof PromisePolyfill)) { throw new Error("Promise must be called with `new`") }
  	if (typeof executor !== "function") { throw new TypeError("executor must be a function") }
  	var self = this, resolvers = [], rejectors = [], resolveCurrent = handler(resolvers, true), rejectCurrent = handler(rejectors, false);
  	var instance = self._instance = {resolvers: resolvers, rejectors: rejectors};
  	var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout;
  	function handler(list, shouldAbsorb) {
  		return function execute(value) {
  			var then;
  			try {
  				if (shouldAbsorb && value != null && (typeof value === "object" || typeof value === "function") && typeof (then = value.then) === "function") {
  					if (value === self) { throw new TypeError("Promise can't be resolved w/ itself") }
  					executeOnce(then.bind(value));
  				}
  				else {
  					callAsync(function() {
  						if (!shouldAbsorb && list.length === 0) { console.error("Possible unhandled promise rejection:", value); }
  						for (var i = 0; i < list.length; i++) { list[i](value); }
  						resolvers.length = 0, rejectors.length = 0;
  						instance.state = shouldAbsorb;
  						instance.retry = function() {execute(value);};
  					});
  				}
  			}
  			catch (e) {
  				rejectCurrent(e);
  			}
  		}
  	}
  	function executeOnce(then) {
  		var runs = 0;
  		function run(fn) {
  			return function(value) {
  				if (runs++ > 0) { return }
  				fn(value);
  			}
  		}
  		var onerror = run(rejectCurrent);
  		try {then(run(resolveCurrent), onerror);} catch (e) {onerror(e);}
  	}
  	executeOnce(executor);
  };
  PromisePolyfill.prototype.then = function(onFulfilled, onRejection) {
  	var self = this, instance = self._instance;
  	function handle(callback, list, next, state) {
  		list.push(function(value) {
  			if (typeof callback !== "function") { next(value); }
  			else { try {resolveNext(callback(value));} catch (e) {if (rejectNext) { rejectNext(e); }} }
  		});
  		if (typeof instance.retry === "function" && state === instance.state) { instance.retry(); }
  	}
  	var resolveNext, rejectNext;
  	var promise = new PromisePolyfill(function(resolve, reject) {resolveNext = resolve, rejectNext = reject;});
  	handle(onFulfilled, instance.resolvers, resolveNext, true), handle(onRejection, instance.rejectors, rejectNext, false);
  	return promise
  };
  PromisePolyfill.prototype.catch = function(onRejection) {
  	return this.then(null, onRejection)
  };
  PromisePolyfill.resolve = function(value) {
  	if (value instanceof PromisePolyfill) { return value }
  	return new PromisePolyfill(function(resolve) {resolve(value);})
  };
  PromisePolyfill.reject = function(value) {
  	return new PromisePolyfill(function(resolve, reject) {reject(value);})
  };
  PromisePolyfill.all = function(list) {
  	return new PromisePolyfill(function(resolve, reject) {
  		var total = list.length, count = 0, values = [];
  		if (list.length === 0) { resolve([]); }
  		else { for (var i = 0; i < list.length; i++) {
  			(function(i) {
  				function consume(value) {
  					count++;
  					values[i] = value;
  					if (count === total) { resolve(values); }
  				}
  				if (list[i] != null && (typeof list[i] === "object" || typeof list[i] === "function") && typeof list[i].then === "function") {
  					list[i].then(consume, reject);
  				}
  				else { consume(list[i]); }
  			})(i);
  		} }
  	})
  };
  PromisePolyfill.race = function(list) {
  	return new PromisePolyfill(function(resolve, reject) {
  		for (var i = 0; i < list.length; i++) {
  			list[i].then(resolve, reject);
  		}
  	})
  };
  if (typeof window !== "undefined") {
  	if (typeof window.Promise === "undefined") { window.Promise = PromisePolyfill; }
  	var PromisePolyfill = window.Promise;
  } else if (typeof commonjsGlobal !== "undefined") {
  	if (typeof commonjsGlobal.Promise === "undefined") { commonjsGlobal.Promise = PromisePolyfill; }
  	var PromisePolyfill = commonjsGlobal.Promise;
  }
  var buildQueryString = function(object) {
  	if (Object.prototype.toString.call(object) !== "[object Object]") { return "" }
  	var args = [];
  	for (var key0 in object) {
  		destructure(key0, object[key0]);
  	}
  	return args.join("&")
  	function destructure(key0, value) {
  		if (Array.isArray(value)) {
  			for (var i = 0; i < value.length; i++) {
  				destructure(key0 + "[" + i + "]", value[i]);
  			}
  		}
  		else if (Object.prototype.toString.call(value) === "[object Object]") {
  			for (var i in value) {
  				destructure(key0 + "[" + i + "]", value[i]);
  			}
  		}
  		else { args.push(encodeURIComponent(key0) + (value != null && value !== "" ? "=" + encodeURIComponent(value) : "")); }
  	}
  };
  var FILE_PROTOCOL_REGEX = new RegExp("^file://", "i");
  var _8 = function($window, Promise) {
  	var callbackCount = 0;
  	var oncompletion;
  	function setCompletionCallback(callback) {oncompletion = callback;}
  	function finalizer() {
  		var count = 0;
  		function complete() {if (--count === 0 && typeof oncompletion === "function") { oncompletion(); }}
  		return function finalize(promise0) {
  			var then0 = promise0.then;
  			promise0.then = function() {
  				count++;
  				var next = then0.apply(promise0, arguments);
  				next.then(complete, function(e) {
  					complete();
  					if (count === 0) { throw e }
  				});
  				return finalize(next)
  			};
  			return promise0
  		}
  	}
  	function normalize(args, extra) {
  		if (typeof args === "string") {
  			var url = args;
  			args = extra || {};
  			if (args.url == null) { args.url = url; }
  		}
  		return args
  	}
  	function request(args, extra) {
  		var finalize = finalizer();
  		args = normalize(args, extra);
  		var promise0 = new Promise(function(resolve, reject) {
  			if (args.method == null) { args.method = "GET"; }
  			args.method = args.method.toUpperCase();
  			var useBody = (args.method === "GET" || args.method === "TRACE") ? false : (typeof args.useBody === "boolean" ? args.useBody : true);
  			if (typeof args.serialize !== "function") { args.serialize = typeof FormData !== "undefined" && args.data instanceof FormData ? function(value) {return value} : JSON.stringify; }
  			if (typeof args.deserialize !== "function") { args.deserialize = deserialize; }
  			if (typeof args.extract !== "function") { args.extract = extract; }
  			args.url = interpolate(args.url, args.data);
  			if (useBody) { args.data = args.serialize(args.data); }
  			else { args.url = assemble(args.url, args.data); }
  			var xhr = new $window.XMLHttpRequest(),
  				aborted = false,
  				_abort = xhr.abort;
  			xhr.abort = function abort() {
  				aborted = true;
  				_abort.call(xhr);
  			};
  			xhr.open(args.method, args.url, typeof args.async === "boolean" ? args.async : true, typeof args.user === "string" ? args.user : undefined, typeof args.password === "string" ? args.password : undefined);
  			if (args.serialize === JSON.stringify && useBody && !(args.headers && args.headers.hasOwnProperty("Content-Type"))) {
  				xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
  			}
  			if (args.deserialize === deserialize && !(args.headers && args.headers.hasOwnProperty("Accept"))) {
  				xhr.setRequestHeader("Accept", "application/json, text/*");
  			}
  			if (args.withCredentials) { xhr.withCredentials = args.withCredentials; }
  			for (var key in args.headers) { if ({}.hasOwnProperty.call(args.headers, key)) {
  				xhr.setRequestHeader(key, args.headers[key]);
  			} }
  			if (typeof args.config === "function") { xhr = args.config(xhr, args) || xhr; }
  			xhr.onreadystatechange = function() {
  				// Don't throw errors on xhr.abort().
  				if(aborted) { return }
  				if (xhr.readyState === 4) {
  					try {
  						var response = (args.extract !== extract) ? args.extract(xhr, args) : args.deserialize(args.extract(xhr, args));
  						if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304 || FILE_PROTOCOL_REGEX.test(args.url)) {
  							resolve(cast(args.type, response));
  						}
  						else {
  							var error = new Error(xhr.responseText);
  							for (var key in response) { error[key] = response[key]; }
  							reject(error);
  						}
  					}
  					catch (e) {
  						reject(e);
  					}
  				}
  			};
  			if (useBody && (args.data != null)) { xhr.send(args.data); }
  			else { xhr.send(); }
  		});
  		return args.background === true ? promise0 : finalize(promise0)
  	}
  	function jsonp(args, extra) {
  		var finalize = finalizer();
  		args = normalize(args, extra);
  		var promise0 = new Promise(function(resolve, reject) {
  			var callbackName = args.callbackName || "_mithril_" + Math.round(Math.random() * 1e16) + "_" + callbackCount++;
  			var script = $window.document.createElement("script");
  			$window[callbackName] = function(data) {
  				script.parentNode.removeChild(script);
  				resolve(cast(args.type, data));
  				delete $window[callbackName];
  			};
  			script.onerror = function() {
  				script.parentNode.removeChild(script);
  				reject(new Error("JSONP request failed"));
  				delete $window[callbackName];
  			};
  			if (args.data == null) { args.data = {}; }
  			args.url = interpolate(args.url, args.data);
  			args.data[args.callbackKey || "callback"] = callbackName;
  			script.src = assemble(args.url, args.data);
  			$window.document.documentElement.appendChild(script);
  		});
  		return args.background === true? promise0 : finalize(promise0)
  	}
  	function interpolate(url, data) {
  		if (data == null) { return url }
  		var tokens = url.match(/:[^\/]+/gi) || [];
  		for (var i = 0; i < tokens.length; i++) {
  			var key = tokens[i].slice(1);
  			if (data[key] != null) {
  				url = url.replace(tokens[i], data[key]);
  			}
  		}
  		return url
  	}
  	function assemble(url, data) {
  		var querystring = buildQueryString(data);
  		if (querystring !== "") {
  			var prefix = url.indexOf("?") < 0 ? "?" : "&";
  			url += prefix + querystring;
  		}
  		return url
  	}
  	function deserialize(data) {
  		try {return data !== "" ? JSON.parse(data) : null}
  		catch (e) {throw new Error(data)}
  	}
  	function extract(xhr) {return xhr.responseText}
  	function cast(type0, data) {
  		if (typeof type0 === "function") {
  			if (Array.isArray(data)) {
  				for (var i = 0; i < data.length; i++) {
  					data[i] = new type0(data[i]);
  				}
  			}
  			else { return new type0(data) }
  		}
  		return data
  	}
  	return {request: request, jsonp: jsonp, setCompletionCallback: setCompletionCallback}
  };
  var requestService = _8(window, PromisePolyfill);
  var coreRenderer = function($window) {
  	var $doc = $window.document;
  	var $emptyFragment = $doc.createDocumentFragment();
  	var nameSpace = {
  		svg: "http://www.w3.org/2000/svg",
  		math: "http://www.w3.org/1998/Math/MathML"
  	};
  	var onevent;
  	function setEventCallback(callback) {return onevent = callback}
  	function getNameSpace(vnode) {
  		return vnode.attrs && vnode.attrs.xmlns || nameSpace[vnode.tag]
  	}
  	//create
  	function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
  		for (var i = start; i < end; i++) {
  			var vnode = vnodes[i];
  			if (vnode != null) {
  				createNode(parent, vnode, hooks, ns, nextSibling);
  			}
  		}
  	}
  	function createNode(parent, vnode, hooks, ns, nextSibling) {
  		var tag = vnode.tag;
  		if (typeof tag === "string") {
  			vnode.state = {};
  			if (vnode.attrs != null) { initLifecycle(vnode.attrs, vnode, hooks); }
  			switch (tag) {
  				case "#": return createText(parent, vnode, nextSibling)
  				case "<": return createHTML(parent, vnode, nextSibling)
  				case "[": return createFragment(parent, vnode, hooks, ns, nextSibling)
  				default: return createElement(parent, vnode, hooks, ns, nextSibling)
  			}
  		}
  		else { return createComponent(parent, vnode, hooks, ns, nextSibling) }
  	}
  	function createText(parent, vnode, nextSibling) {
  		vnode.dom = $doc.createTextNode(vnode.children);
  		insertNode(parent, vnode.dom, nextSibling);
  		return vnode.dom
  	}
  	function createHTML(parent, vnode, nextSibling) {
  		var match1 = vnode.children.match(/^\s*?<(\w+)/im) || [];
  		var parent1 = {caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup"}[match1[1]] || "div";
  		var temp = $doc.createElement(parent1);
  		temp.innerHTML = vnode.children;
  		vnode.dom = temp.firstChild;
  		vnode.domSize = temp.childNodes.length;
  		var fragment = $doc.createDocumentFragment();
  		var child;
  		while (child = temp.firstChild) {
  			fragment.appendChild(child);
  		}
  		insertNode(parent, fragment, nextSibling);
  		return fragment
  	}
  	function createFragment(parent, vnode, hooks, ns, nextSibling) {
  		var fragment = $doc.createDocumentFragment();
  		if (vnode.children != null) {
  			var children = vnode.children;
  			createNodes(fragment, children, 0, children.length, hooks, null, ns);
  		}
  		vnode.dom = fragment.firstChild;
  		vnode.domSize = fragment.childNodes.length;
  		insertNode(parent, fragment, nextSibling);
  		return fragment
  	}
  	function createElement(parent, vnode, hooks, ns, nextSibling) {
  		var tag = vnode.tag;
  		var attrs2 = vnode.attrs;
  		var is = attrs2 && attrs2.is;
  		ns = getNameSpace(vnode) || ns;
  		var element = ns ?
  			is ? $doc.createElementNS(ns, tag, {is: is}) : $doc.createElementNS(ns, tag) :
  			is ? $doc.createElement(tag, {is: is}) : $doc.createElement(tag);
  		vnode.dom = element;
  		if (attrs2 != null) {
  			setAttrs(vnode, attrs2, ns);
  		}
  		insertNode(parent, element, nextSibling);
  		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
  			setContentEditable(vnode);
  		}
  		else {
  			if (vnode.text != null) {
  				if (vnode.text !== "") { element.textContent = vnode.text; }
  				else { vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]; }
  			}
  			if (vnode.children != null) {
  				var children = vnode.children;
  				createNodes(element, children, 0, children.length, hooks, null, ns);
  				setLateAttrs(vnode);
  			}
  		}
  		return element
  	}
  	function initComponent(vnode, hooks) {
  		var sentinel;
  		if (typeof vnode.tag.view === "function") {
  			vnode.state = Object.create(vnode.tag);
  			sentinel = vnode.state.view;
  			if (sentinel.$$reentrantLock$$ != null) { return $emptyFragment }
  			sentinel.$$reentrantLock$$ = true;
  		} else {
  			vnode.state = void 0;
  			sentinel = vnode.tag;
  			if (sentinel.$$reentrantLock$$ != null) { return $emptyFragment }
  			sentinel.$$reentrantLock$$ = true;
  			vnode.state = (vnode.tag.prototype != null && typeof vnode.tag.prototype.view === "function") ? new vnode.tag(vnode) : vnode.tag(vnode);
  		}
  		vnode._state = vnode.state;
  		if (vnode.attrs != null) { initLifecycle(vnode.attrs, vnode, hooks); }
  		initLifecycle(vnode._state, vnode, hooks);
  		vnode.instance = Vnode.normalize(vnode._state.view.call(vnode.state, vnode));
  		if (vnode.instance === vnode) { throw Error("A view cannot return the vnode it received as argument") }
  		sentinel.$$reentrantLock$$ = null;
  	}
  	function createComponent(parent, vnode, hooks, ns, nextSibling) {
  		initComponent(vnode, hooks);
  		if (vnode.instance != null) {
  			var element = createNode(parent, vnode.instance, hooks, ns, nextSibling);
  			vnode.dom = vnode.instance.dom;
  			vnode.domSize = vnode.dom != null ? vnode.instance.domSize : 0;
  			insertNode(parent, element, nextSibling);
  			return element
  		}
  		else {
  			vnode.domSize = 0;
  			return $emptyFragment
  		}
  	}
  	//update
  	function updateNodes(parent, old, vnodes, recycling, hooks, nextSibling, ns) {
  		if (old === vnodes || old == null && vnodes == null) { return }
  		else if (old == null) { createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns); }
  		else if (vnodes == null) { removeNodes(old, 0, old.length, vnodes); }
  		else {
  			if (old.length === vnodes.length) {
  				var isUnkeyed = false;
  				for (var i = 0; i < vnodes.length; i++) {
  					if (vnodes[i] != null && old[i] != null) {
  						isUnkeyed = vnodes[i].key == null && old[i].key == null;
  						break
  					}
  				}
  				if (isUnkeyed) {
  					for (var i = 0; i < old.length; i++) {
  						if (old[i] === vnodes[i]) { continue }
  						else if (old[i] == null && vnodes[i] != null) { createNode(parent, vnodes[i], hooks, ns, getNextSibling(old, i + 1, nextSibling)); }
  						else if (vnodes[i] == null) { removeNodes(old, i, i + 1, vnodes); }
  						else { updateNode(parent, old[i], vnodes[i], hooks, getNextSibling(old, i + 1, nextSibling), recycling, ns); }
  					}
  					return
  				}
  			}
  			recycling = recycling || isRecyclable(old, vnodes);
  			if (recycling) {
  				var pool = old.pool;
  				old = old.concat(old.pool);
  			}
  			var oldStart = 0, start = 0, oldEnd = old.length - 1, end = vnodes.length - 1, map;
  			while (oldEnd >= oldStart && end >= start) {
  				var o = old[oldStart], v = vnodes[start];
  				if (o === v && !recycling) { oldStart++, start++; }
  				else if (o == null) { oldStart++; }
  				else if (v == null) { start++; }
  				else if (o.key === v.key) {
  					var shouldRecycle = (pool != null && oldStart >= old.length - pool.length) || ((pool == null) && recycling);
  					oldStart++, start++;
  					updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), shouldRecycle, ns);
  					if (recycling && o.tag === v.tag) { insertNode(parent, toFragment(o), nextSibling); }
  				}
  				else {
  					var o = old[oldEnd];
  					if (o === v && !recycling) { oldEnd--, start++; }
  					else if (o == null) { oldEnd--; }
  					else if (v == null) { start++; }
  					else if (o.key === v.key) {
  						var shouldRecycle = (pool != null && oldEnd >= old.length - pool.length) || ((pool == null) && recycling);
  						updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), shouldRecycle, ns);
  						if (recycling || start < end) { insertNode(parent, toFragment(o), getNextSibling(old, oldStart, nextSibling)); }
  						oldEnd--, start++;
  					}
  					else { break }
  				}
  			}
  			while (oldEnd >= oldStart && end >= start) {
  				var o = old[oldEnd], v = vnodes[end];
  				if (o === v && !recycling) { oldEnd--, end--; }
  				else if (o == null) { oldEnd--; }
  				else if (v == null) { end--; }
  				else if (o.key === v.key) {
  					var shouldRecycle = (pool != null && oldEnd >= old.length - pool.length) || ((pool == null) && recycling);
  					updateNode(parent, o, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), shouldRecycle, ns);
  					if (recycling && o.tag === v.tag) { insertNode(parent, toFragment(o), nextSibling); }
  					if (o.dom != null) { nextSibling = o.dom; }
  					oldEnd--, end--;
  				}
  				else {
  					if (!map) { map = getKeyMap(old, oldEnd); }
  					if (v != null) {
  						var oldIndex = map[v.key];
  						if (oldIndex != null) {
  							var movable = old[oldIndex];
  							var shouldRecycle = (pool != null && oldIndex >= old.length - pool.length) || ((pool == null) && recycling);
  							updateNode(parent, movable, v, hooks, getNextSibling(old, oldEnd + 1, nextSibling), recycling, ns);
  							insertNode(parent, toFragment(movable), nextSibling);
  							old[oldIndex].skip = true;
  							if (movable.dom != null) { nextSibling = movable.dom; }
  						}
  						else {
  							var dom = createNode(parent, v, hooks, ns, nextSibling);
  							nextSibling = dom;
  						}
  					}
  					end--;
  				}
  				if (end < start) { break }
  			}
  			createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns);
  			removeNodes(old, oldStart, oldEnd + 1, vnodes);
  		}
  	}
  	function updateNode(parent, old, vnode, hooks, nextSibling, recycling, ns) {
  		var oldTag = old.tag, tag = vnode.tag;
  		if (oldTag === tag) {
  			vnode.state = old.state;
  			vnode._state = old._state;
  			vnode.events = old.events;
  			if (!recycling && shouldNotUpdate(vnode, old)) { return }
  			if (typeof oldTag === "string") {
  				if (vnode.attrs != null) {
  					if (recycling) {
  						vnode.state = {};
  						initLifecycle(vnode.attrs, vnode, hooks);
  					}
  					else { updateLifecycle(vnode.attrs, vnode, hooks); }
  				}
  				switch (oldTag) {
  					case "#": updateText(old, vnode); break
  					case "<": updateHTML(parent, old, vnode, nextSibling); break
  					case "[": updateFragment(parent, old, vnode, recycling, hooks, nextSibling, ns); break
  					default: updateElement(old, vnode, recycling, hooks, ns);
  				}
  			}
  			else { updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns); }
  		}
  		else {
  			removeNode(old, null);
  			createNode(parent, vnode, hooks, ns, nextSibling);
  		}
  	}
  	function updateText(old, vnode) {
  		if (old.children.toString() !== vnode.children.toString()) {
  			old.dom.nodeValue = vnode.children;
  		}
  		vnode.dom = old.dom;
  	}
  	function updateHTML(parent, old, vnode, nextSibling) {
  		if (old.children !== vnode.children) {
  			toFragment(old);
  			createHTML(parent, vnode, nextSibling);
  		}
  		else { vnode.dom = old.dom, vnode.domSize = old.domSize; }
  	}
  	function updateFragment(parent, old, vnode, recycling, hooks, nextSibling, ns) {
  		updateNodes(parent, old.children, vnode.children, recycling, hooks, nextSibling, ns);
  		var domSize = 0, children = vnode.children;
  		vnode.dom = null;
  		if (children != null) {
  			for (var i = 0; i < children.length; i++) {
  				var child = children[i];
  				if (child != null && child.dom != null) {
  					if (vnode.dom == null) { vnode.dom = child.dom; }
  					domSize += child.domSize || 1;
  				}
  			}
  			if (domSize !== 1) { vnode.domSize = domSize; }
  		}
  	}
  	function updateElement(old, vnode, recycling, hooks, ns) {
  		var element = vnode.dom = old.dom;
  		ns = getNameSpace(vnode) || ns;
  		if (vnode.tag === "textarea") {
  			if (vnode.attrs == null) { vnode.attrs = {}; }
  			if (vnode.text != null) {
  				vnode.attrs.value = vnode.text; //FIXME handle0 multiple children
  				vnode.text = undefined;
  			}
  		}
  		updateAttrs(vnode, old.attrs, vnode.attrs, ns);
  		if (vnode.attrs != null && vnode.attrs.contenteditable != null) {
  			setContentEditable(vnode);
  		}
  		else if (old.text != null && vnode.text != null && vnode.text !== "") {
  			if (old.text.toString() !== vnode.text.toString()) { old.dom.firstChild.nodeValue = vnode.text; }
  		}
  		else {
  			if (old.text != null) { old.children = [Vnode("#", undefined, undefined, old.text, undefined, old.dom.firstChild)]; }
  			if (vnode.text != null) { vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]; }
  			updateNodes(element, old.children, vnode.children, recycling, hooks, null, ns);
  		}
  	}
  	function updateComponent(parent, old, vnode, hooks, nextSibling, recycling, ns) {
  		if (recycling) {
  			initComponent(vnode, hooks);
  		} else {
  			vnode.instance = Vnode.normalize(vnode._state.view.call(vnode.state, vnode));
  			if (vnode.instance === vnode) { throw Error("A view cannot return the vnode it received as argument") }
  			if (vnode.attrs != null) { updateLifecycle(vnode.attrs, vnode, hooks); }
  			updateLifecycle(vnode._state, vnode, hooks);
  		}
  		if (vnode.instance != null) {
  			if (old.instance == null) { createNode(parent, vnode.instance, hooks, ns, nextSibling); }
  			else { updateNode(parent, old.instance, vnode.instance, hooks, nextSibling, recycling, ns); }
  			vnode.dom = vnode.instance.dom;
  			vnode.domSize = vnode.instance.domSize;
  		}
  		else if (old.instance != null) {
  			removeNode(old.instance, null);
  			vnode.dom = undefined;
  			vnode.domSize = 0;
  		}
  		else {
  			vnode.dom = old.dom;
  			vnode.domSize = old.domSize;
  		}
  	}
  	function isRecyclable(old, vnodes) {
  		if (old.pool != null && Math.abs(old.pool.length - vnodes.length) <= Math.abs(old.length - vnodes.length)) {
  			var oldChildrenLength = old[0] && old[0].children && old[0].children.length || 0;
  			var poolChildrenLength = old.pool[0] && old.pool[0].children && old.pool[0].children.length || 0;
  			var vnodesChildrenLength = vnodes[0] && vnodes[0].children && vnodes[0].children.length || 0;
  			if (Math.abs(poolChildrenLength - vnodesChildrenLength) <= Math.abs(oldChildrenLength - vnodesChildrenLength)) {
  				return true
  			}
  		}
  		return false
  	}
  	function getKeyMap(vnodes, end) {
  		var map = {}, i = 0;
  		for (var i = 0; i < end; i++) {
  			var vnode = vnodes[i];
  			if (vnode != null) {
  				var key2 = vnode.key;
  				if (key2 != null) { map[key2] = i; }
  			}
  		}
  		return map
  	}
  	function toFragment(vnode) {
  		var count0 = vnode.domSize;
  		if (count0 != null || vnode.dom == null) {
  			var fragment = $doc.createDocumentFragment();
  			if (count0 > 0) {
  				var dom = vnode.dom;
  				while (--count0) { fragment.appendChild(dom.nextSibling); }
  				fragment.insertBefore(dom, fragment.firstChild);
  			}
  			return fragment
  		}
  		else { return vnode.dom }
  	}
  	function getNextSibling(vnodes, i, nextSibling) {
  		for (; i < vnodes.length; i++) {
  			if (vnodes[i] != null && vnodes[i].dom != null) { return vnodes[i].dom }
  		}
  		return nextSibling
  	}
  	function insertNode(parent, dom, nextSibling) {
  		if (nextSibling && nextSibling.parentNode) { parent.insertBefore(dom, nextSibling); }
  		else { parent.appendChild(dom); }
  	}
  	function setContentEditable(vnode) {
  		var children = vnode.children;
  		if (children != null && children.length === 1 && children[0].tag === "<") {
  			var content = children[0].children;
  			if (vnode.dom.innerHTML !== content) { vnode.dom.innerHTML = content; }
  		}
  		else if (vnode.text != null || children != null && children.length !== 0) { throw new Error("Child node of a contenteditable must be trusted") }
  	}
  	//remove
  	function removeNodes(vnodes, start, end, context) {
  		for (var i = start; i < end; i++) {
  			var vnode = vnodes[i];
  			if (vnode != null) {
  				if (vnode.skip) { vnode.skip = false; }
  				else { removeNode(vnode, context); }
  			}
  		}
  	}
  	function removeNode(vnode, context) {
  		var expected = 1, called = 0;
  		if (vnode.attrs && typeof vnode.attrs.onbeforeremove === "function") {
  			var result = vnode.attrs.onbeforeremove.call(vnode.state, vnode);
  			if (result != null && typeof result.then === "function") {
  				expected++;
  				result.then(continuation, continuation);
  			}
  		}
  		if (typeof vnode.tag !== "string" && typeof vnode._state.onbeforeremove === "function") {
  			var result = vnode._state.onbeforeremove.call(vnode.state, vnode);
  			if (result != null && typeof result.then === "function") {
  				expected++;
  				result.then(continuation, continuation);
  			}
  		}
  		continuation();
  		function continuation() {
  			if (++called === expected) {
  				onremove(vnode);
  				if (vnode.dom) {
  					var count0 = vnode.domSize || 1;
  					if (count0 > 1) {
  						var dom = vnode.dom;
  						while (--count0) {
  							removeNodeFromDOM(dom.nextSibling);
  						}
  					}
  					removeNodeFromDOM(vnode.dom);
  					if (context != null && vnode.domSize == null && !hasIntegrationMethods(vnode.attrs) && typeof vnode.tag === "string") { //TODO test custom elements
  						if (!context.pool) { context.pool = [vnode]; }
  						else { context.pool.push(vnode); }
  					}
  				}
  			}
  		}
  	}
  	function removeNodeFromDOM(node) {
  		var parent = node.parentNode;
  		if (parent != null) { parent.removeChild(node); }
  	}
  	function onremove(vnode) {
  		if (vnode.attrs && typeof vnode.attrs.onremove === "function") { vnode.attrs.onremove.call(vnode.state, vnode); }
  		if (typeof vnode.tag !== "string") {
  			if (typeof vnode._state.onremove === "function") { vnode._state.onremove.call(vnode.state, vnode); }
  			if (vnode.instance != null) { onremove(vnode.instance); }
  		} else {
  			var children = vnode.children;
  			if (Array.isArray(children)) {
  				for (var i = 0; i < children.length; i++) {
  					var child = children[i];
  					if (child != null) { onremove(child); }
  				}
  			}
  		}
  	}
  	//attrs2
  	function setAttrs(vnode, attrs2, ns) {
  		for (var key2 in attrs2) {
  			setAttr(vnode, key2, null, attrs2[key2], ns);
  		}
  	}
  	function setAttr(vnode, key2, old, value, ns) {
  		var element = vnode.dom;
  		if (key2 === "key" || key2 === "is" || (old === value && !isFormAttribute(vnode, key2)) && typeof value !== "object" || typeof value === "undefined" || isLifecycleMethod(key2)) { return }
  		var nsLastIndex = key2.indexOf(":");
  		if (nsLastIndex > -1 && key2.substr(0, nsLastIndex) === "xlink") {
  			element.setAttributeNS("http://www.w3.org/1999/xlink", key2.slice(nsLastIndex + 1), value);
  		}
  		else if (key2[0] === "o" && key2[1] === "n" && typeof value === "function") { updateEvent(vnode, key2, value); }
  		else if (key2 === "style") { updateStyle(element, old, value); }
  		else if (key2 in element && !isAttribute(key2) && ns === undefined && !isCustomElement(vnode)) {
  			if (key2 === "value") {
  				var normalized0 = "" + value; // eslint-disable-line no-implicit-coercion
  				//setting input[value] to same value by typing on focused element moves cursor to end in Chrome
  				if ((vnode.tag === "input" || vnode.tag === "textarea") && vnode.dom.value === normalized0 && vnode.dom === $doc.activeElement) { return }
  				//setting select[value] to same value while having select open blinks select dropdown in Chrome
  				if (vnode.tag === "select") {
  					if (value === null) {
  						if (vnode.dom.selectedIndex === -1 && vnode.dom === $doc.activeElement) { return }
  					} else {
  						if (old !== null && vnode.dom.value === normalized0 && vnode.dom === $doc.activeElement) { return }
  					}
  				}
  				//setting option[value] to same value while having select open blinks select dropdown in Chrome
  				if (vnode.tag === "option" && old != null && vnode.dom.value === normalized0) { return }
  			}
  			// If you assign an input type1 that is not supported by IE 11 with an assignment expression, an error0 will occur.
  			if (vnode.tag === "input" && key2 === "type") {
  				element.setAttribute(key2, value);
  				return
  			}
  			element[key2] = value;
  		}
  		else {
  			if (typeof value === "boolean") {
  				if (value) { element.setAttribute(key2, ""); }
  				else { element.removeAttribute(key2); }
  			}
  			else { element.setAttribute(key2 === "className" ? "class" : key2, value); }
  		}
  	}
  	function setLateAttrs(vnode) {
  		var attrs2 = vnode.attrs;
  		if (vnode.tag === "select" && attrs2 != null) {
  			if ("value" in attrs2) { setAttr(vnode, "value", null, attrs2.value, undefined); }
  			if ("selectedIndex" in attrs2) { setAttr(vnode, "selectedIndex", null, attrs2.selectedIndex, undefined); }
  		}
  	}
  	function updateAttrs(vnode, old, attrs2, ns) {
  		if (attrs2 != null) {
  			for (var key2 in attrs2) {
  				setAttr(vnode, key2, old && old[key2], attrs2[key2], ns);
  			}
  		}
  		if (old != null) {
  			for (var key2 in old) {
  				if (attrs2 == null || !(key2 in attrs2)) {
  					if (key2 === "className") { key2 = "class"; }
  					if (key2[0] === "o" && key2[1] === "n" && !isLifecycleMethod(key2)) { updateEvent(vnode, key2, undefined); }
  					else if (key2 !== "key") { vnode.dom.removeAttribute(key2); }
  				}
  			}
  		}
  	}
  	function isFormAttribute(vnode, attr) {
  		return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && vnode.dom === $doc.activeElement
  	}
  	function isLifecycleMethod(attr) {
  		return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate"
  	}
  	function isAttribute(attr) {
  		return attr === "href" || attr === "list" || attr === "form" || attr === "width" || attr === "height"// || attr === "type"
  	}
  	function isCustomElement(vnode){
  		return vnode.attrs.is || vnode.tag.indexOf("-") > -1
  	}
  	function hasIntegrationMethods(source) {
  		return source != null && (source.oncreate || source.onupdate || source.onbeforeremove || source.onremove)
  	}
  	//style
  	function updateStyle(element, old, style) {
  		if (old === style) { element.style.cssText = "", old = null; }
  		if (style == null) { element.style.cssText = ""; }
  		else if (typeof style === "string") { element.style.cssText = style; }
  		else {
  			if (typeof old === "string") { element.style.cssText = ""; }
  			for (var key2 in style) {
  				element.style[key2] = style[key2];
  			}
  			if (old != null && typeof old !== "string") {
  				for (var key2 in old) {
  					if (!(key2 in style)) { element.style[key2] = ""; }
  				}
  			}
  		}
  	}
  	//event
  	function updateEvent(vnode, key2, value) {
  		var element = vnode.dom;
  		var callback = typeof onevent !== "function" ? value : function(e) {
  			var result = value.call(element, e);
  			onevent.call(element, e);
  			return result
  		};
  		if (key2 in element) { element[key2] = typeof value === "function" ? callback : null; }
  		else {
  			var eventName = key2.slice(2);
  			if (vnode.events === undefined) { vnode.events = {}; }
  			if (vnode.events[key2] === callback) { return }
  			if (vnode.events[key2] != null) { element.removeEventListener(eventName, vnode.events[key2], false); }
  			if (typeof value === "function") {
  				vnode.events[key2] = callback;
  				element.addEventListener(eventName, vnode.events[key2], false);
  			}
  		}
  	}
  	//lifecycle
  	function initLifecycle(source, vnode, hooks) {
  		if (typeof source.oninit === "function") { source.oninit.call(vnode.state, vnode); }
  		if (typeof source.oncreate === "function") { hooks.push(source.oncreate.bind(vnode.state, vnode)); }
  	}
  	function updateLifecycle(source, vnode, hooks) {
  		if (typeof source.onupdate === "function") { hooks.push(source.onupdate.bind(vnode.state, vnode)); }
  	}
  	function shouldNotUpdate(vnode, old) {
  		var forceVnodeUpdate, forceComponentUpdate;
  		if (vnode.attrs != null && typeof vnode.attrs.onbeforeupdate === "function") { forceVnodeUpdate = vnode.attrs.onbeforeupdate.call(vnode.state, vnode, old); }
  		if (typeof vnode.tag !== "string" && typeof vnode._state.onbeforeupdate === "function") { forceComponentUpdate = vnode._state.onbeforeupdate.call(vnode.state, vnode, old); }
  		if (!(forceVnodeUpdate === undefined && forceComponentUpdate === undefined) && !forceVnodeUpdate && !forceComponentUpdate) {
  			vnode.dom = old.dom;
  			vnode.domSize = old.domSize;
  			vnode.instance = old.instance;
  			return true
  		}
  		return false
  	}
  	function render(dom, vnodes) {
  		if (!dom) { throw new Error("Ensure the DOM element being passed to m.route/m.mount/m.render is not undefined.") }
  		var hooks = [];
  		var active = $doc.activeElement;
  		var namespace = dom.namespaceURI;
  		// First time0 rendering into a node clears it out
  		if (dom.vnodes == null) { dom.textContent = ""; }
  		if (!Array.isArray(vnodes)) { vnodes = [vnodes]; }
  		updateNodes(dom, dom.vnodes, Vnode.normalizeChildren(vnodes), false, hooks, null, namespace === "http://www.w3.org/1999/xhtml" ? undefined : namespace);
  		dom.vnodes = vnodes;
  		// document.activeElement can return null in IE https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement
  		if (active != null && $doc.activeElement !== active) { active.focus(); }
  		for (var i = 0; i < hooks.length; i++) { hooks[i](); }
  	}
  	return {render: render, setEventCallback: setEventCallback}
  };
  function throttle(callback) {
  	//60fps translates to 16.6ms, round it down since setTimeout requires int
  	var time = 16;
  	var last = 0, pending = null;
  	var timeout = typeof requestAnimationFrame === "function" ? requestAnimationFrame : setTimeout;
  	return function() {
  		var now = Date.now();
  		if (last === 0 || now - last >= time) {
  			last = now;
  			callback();
  		}
  		else if (pending === null) {
  			pending = timeout(function() {
  				pending = null;
  				callback();
  				last = Date.now();
  			}, time - (now - last));
  		}
  	}
  }
  var _11 = function($window) {
  	var renderService = coreRenderer($window);
  	renderService.setEventCallback(function(e) {
  		if (e.redraw === false) { e.redraw = undefined; }
  		else { redraw(); }
  	});
  	var callbacks = [];
  	function subscribe(key1, callback) {
  		unsubscribe(key1);
  		callbacks.push(key1, throttle(callback));
  	}
  	function unsubscribe(key1) {
  		var index = callbacks.indexOf(key1);
  		if (index > -1) { callbacks.splice(index, 2); }
  	}
  	function redraw() {
  		for (var i = 1; i < callbacks.length; i += 2) {
  			callbacks[i]();
  		}
  	}
  	return {subscribe: subscribe, unsubscribe: unsubscribe, redraw: redraw, render: renderService.render}
  };
  var redrawService = _11(window);
  requestService.setCompletionCallback(redrawService.redraw);
  var _16 = function(redrawService0) {
  	return function(root, component) {
  		if (component === null) {
  			redrawService0.render(root, []);
  			redrawService0.unsubscribe(root);
  			return
  		}
  		
  		if (component.view == null && typeof component !== "function") { throw new Error("m.mount(element, component) expects a component, not a vnode") }
  		
  		var run0 = function() {
  			redrawService0.render(root, Vnode(component));
  		};
  		redrawService0.subscribe(root, run0);
  		redrawService0.redraw();
  	}
  };
  m.mount = _16(redrawService);
  var Promise = PromisePolyfill;
  var parseQueryString = function(string) {
  	if (string === "" || string == null) { return {} }
  	if (string.charAt(0) === "?") { string = string.slice(1); }
  	var entries = string.split("&"), data0 = {}, counters = {};
  	for (var i = 0; i < entries.length; i++) {
  		var entry = entries[i].split("=");
  		var key5 = decodeURIComponent(entry[0]);
  		var value = entry.length === 2 ? decodeURIComponent(entry[1]) : "";
  		if (value === "true") { value = true; }
  		else if (value === "false") { value = false; }
  		var levels = key5.split(/\]\[?|\[/);
  		var cursor = data0;
  		if (key5.indexOf("[") > -1) { levels.pop(); }
  		for (var j = 0; j < levels.length; j++) {
  			var level = levels[j], nextLevel = levels[j + 1];
  			var isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10));
  			var isValue = j === levels.length - 1;
  			if (level === "") {
  				var key5 = levels.slice(0, j).join();
  				if (counters[key5] == null) { counters[key5] = 0; }
  				level = counters[key5]++;
  			}
  			if (cursor[level] == null) {
  				cursor[level] = isValue ? value : isNumber ? [] : {};
  			}
  			cursor = cursor[level];
  		}
  	}
  	return data0
  };
  var coreRouter = function($window) {
  	var supportsPushState = typeof $window.history.pushState === "function";
  	var callAsync0 = typeof setImmediate === "function" ? setImmediate : setTimeout;
  	function normalize1(fragment0) {
  		var data = $window.location[fragment0].replace(/(?:%[a-f89][a-f0-9])+/gim, decodeURIComponent);
  		if (fragment0 === "pathname" && data[0] !== "/") { data = "/" + data; }
  		return data
  	}
  	var asyncId;
  	function debounceAsync(callback0) {
  		return function() {
  			if (asyncId != null) { return }
  			asyncId = callAsync0(function() {
  				asyncId = null;
  				callback0();
  			});
  		}
  	}
  	function parsePath(path, queryData, hashData) {
  		var queryIndex = path.indexOf("?");
  		var hashIndex = path.indexOf("#");
  		var pathEnd = queryIndex > -1 ? queryIndex : hashIndex > -1 ? hashIndex : path.length;
  		if (queryIndex > -1) {
  			var queryEnd = hashIndex > -1 ? hashIndex : path.length;
  			var queryParams = parseQueryString(path.slice(queryIndex + 1, queryEnd));
  			for (var key4 in queryParams) { queryData[key4] = queryParams[key4]; }
  		}
  		if (hashIndex > -1) {
  			var hashParams = parseQueryString(path.slice(hashIndex + 1));
  			for (var key4 in hashParams) { hashData[key4] = hashParams[key4]; }
  		}
  		return path.slice(0, pathEnd)
  	}
  	var router = {prefix: "#!"};
  	router.getPath = function() {
  		var type2 = router.prefix.charAt(0);
  		switch (type2) {
  			case "#": return normalize1("hash").slice(router.prefix.length)
  			case "?": return normalize1("search").slice(router.prefix.length) + normalize1("hash")
  			default: return normalize1("pathname").slice(router.prefix.length) + normalize1("search") + normalize1("hash")
  		}
  	};
  	router.setPath = function(path, data, options) {
  		var queryData = {}, hashData = {};
  		path = parsePath(path, queryData, hashData);
  		if (data != null) {
  			for (var key4 in data) { queryData[key4] = data[key4]; }
  			path = path.replace(/:([^\/]+)/g, function(match2, token) {
  				delete queryData[token];
  				return data[token]
  			});
  		}
  		var query = buildQueryString(queryData);
  		if (query) { path += "?" + query; }
  		var hash = buildQueryString(hashData);
  		if (hash) { path += "#" + hash; }
  		if (supportsPushState) {
  			var state = options ? options.state : null;
  			var title = options ? options.title : null;
  			$window.onpopstate();
  			if (options && options.replace) { $window.history.replaceState(state, title, router.prefix + path); }
  			else { $window.history.pushState(state, title, router.prefix + path); }
  		}
  		else { $window.location.href = router.prefix + path; }
  	};
  	router.defineRoutes = function(routes, resolve, reject) {
  		function resolveRoute() {
  			var path = router.getPath();
  			var params = {};
  			var pathname = parsePath(path, params, params);
  			var state = $window.history.state;
  			if (state != null) {
  				for (var k in state) { params[k] = state[k]; }
  			}
  			for (var route0 in routes) {
  				var matcher = new RegExp("^" + route0.replace(/:[^\/]+?\.{3}/g, "(.*?)").replace(/:[^\/]+/g, "([^\\/]+)") + "\/?$");
  				if (matcher.test(pathname)) {
  					pathname.replace(matcher, function() {
  						var keys = route0.match(/:[^\/]+/g) || [];
  						var values = [].slice.call(arguments, 1, -2);
  						for (var i = 0; i < keys.length; i++) {
  							params[keys[i].replace(/:|\./g, "")] = decodeURIComponent(values[i]);
  						}
  						resolve(routes[route0], params, path, route0);
  					});
  					return
  				}
  			}
  			reject(path, params);
  		}
  		if (supportsPushState) { $window.onpopstate = debounceAsync(resolveRoute); }
  		else if (router.prefix.charAt(0) === "#") { $window.onhashchange = resolveRoute; }
  		resolveRoute();
  	};
  	return router
  };
  var _20 = function($window, redrawService0) {
  	var routeService = coreRouter($window);
  	var identity = function(v) {return v};
  	var render1, component, attrs3, currentPath, lastUpdate;
  	var route = function(root, defaultRoute, routes) {
  		if (root == null) { throw new Error("Ensure the DOM element that was passed to `m.route` is not undefined") }
  		var run1 = function() {
  			if (render1 != null) { redrawService0.render(root, render1(Vnode(component, attrs3.key, attrs3))); }
  		};
  		var bail = function(path) {
  			if (path !== defaultRoute) { routeService.setPath(defaultRoute, null, {replace: true}); }
  			else { throw new Error("Could not resolve default route " + defaultRoute) }
  		};
  		routeService.defineRoutes(routes, function(payload, params, path) {
  			var update = lastUpdate = function(routeResolver, comp) {
  				if (update !== lastUpdate) { return }
  				component = comp != null && (typeof comp.view === "function" || typeof comp === "function")? comp : "div";
  				attrs3 = params, currentPath = path, lastUpdate = null;
  				render1 = (routeResolver.render || identity).bind(routeResolver);
  				run1();
  			};
  			if (payload.view || typeof payload === "function") { update({}, payload); }
  			else {
  				if (payload.onmatch) {
  					Promise.resolve(payload.onmatch(params, path)).then(function(resolved) {
  						update(payload, resolved);
  					}, bail);
  				}
  				else { update(payload, "div"); }
  			}
  		}, bail);
  		redrawService0.subscribe(root, run1);
  	};
  	route.set = function(path, data, options) {
  		if (lastUpdate != null) {
  			options = options || {};
  			options.replace = true;
  		}
  		lastUpdate = null;
  		routeService.setPath(path, data, options);
  	};
  	route.get = function() {return currentPath};
  	route.prefix = function(prefix0) {routeService.prefix = prefix0;};
  	route.link = function(vnode1) {
  		vnode1.dom.setAttribute("href", routeService.prefix + vnode1.attrs.href);
  		vnode1.dom.onclick = function(e) {
  			if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2) { return }
  			e.preventDefault();
  			e.redraw = false;
  			var href = this.getAttribute("href");
  			if (href.indexOf(routeService.prefix) === 0) { href = href.slice(routeService.prefix.length); }
  			route.set(href, undefined, undefined);
  		};
  	};
  	route.param = function(key3) {
  		if(typeof attrs3 !== "undefined" && typeof key3 !== "undefined") { return attrs3[key3] }
  		return attrs3
  	};
  	return route
  };
  m.route = _20(window, redrawService);
  m.withAttr = function(attrName, callback1, context) {
  	return function(e) {
  		callback1.call(context || this, attrName in e.currentTarget ? e.currentTarget[attrName] : e.currentTarget.getAttribute(attrName));
  	}
  };
  var _28 = coreRenderer(window);
  m.render = _28.render;
  m.redraw = redrawService.redraw;
  m.request = requestService.request;
  m.jsonp = requestService.jsonp;
  m.parseQueryString = parseQueryString;
  m.buildQueryString = buildQueryString;
  m.version = "1.1.6";
  m.vnode = Vnode;
  { module["exports"] = m; }
  }());
  });

  var pseudos = [
    ':active',
    ':any',
    ':checked',
    ':default',
    ':disabled',
    ':empty',
    ':enabled',
    ':first',
    ':first-child',
    ':first-of-type',
    ':fullscreen',
    ':focus',
    ':hover',
    ':indeterminate',
    ':in-range',
    ':invalid',
    ':last-child',
    ':last-of-type',
    ':left',
    ':link',
    ':only-child',
    ':only-of-type',
    ':optional',
    ':out-of-range',
    ':read-only',
    ':read-write',
    ':required',
    ':right',
    ':root',
    ':scope',
    ':target',
    ':valid',
    ':visited',

    // With value
    ':dir',
    ':lang',
    ':not',
    ':nth-child',
    ':nth-last-child',
    ':nth-last-of-type',
    ':nth-of-type',

    // Elements
    '::after',
    '::before',
    '::first-letter',
    '::first-line',
    '::selection',
    '::backdrop',
    '::placeholder',
    '::marker',
    '::spelling-error',
    '::grammar-error'
  ];

  var popular = {
    ai : 'alignItems',
    b  : 'bottom',
    bc : 'backgroundColor',
    br : 'borderRadius',
    bs : 'boxShadow',
    bi : 'backgroundImage',
    c  : 'color',
    d  : 'display',
    f  : 'float',
    fd : 'flexDirection',
    ff : 'fontFamily',
    fs : 'fontSize',
    h  : 'height',
    jc : 'justifyContent',
    l  : 'left',
    lh : 'lineHeight',
    ls : 'letterSpacing',
    m  : 'margin',
    mb : 'marginBottom',
    ml : 'marginLeft',
    mr : 'marginRight',
    mt : 'marginTop',
    o  : 'opacity',
    p  : 'padding',
    pb : 'paddingBottom',
    pl : 'paddingLeft',
    pr : 'paddingRight',
    pt : 'paddingTop',
    r  : 'right',
    t  : 'top',
    ta : 'textAlign',
    td : 'textDecoration',
    tt : 'textTransform',
    w  : 'width'
  };

  var cssProperties = ['float'].concat(Object.keys(
    typeof document === 'undefined'
      ? {}
      : findWidth(document.documentElement.style)
  ).filter(function (p) { return p.indexOf('-') === -1 && p !== 'length'; }));

  function findWidth(obj) {
    return obj
      ? obj.hasOwnProperty('width')
        ? obj
        : findWidth(Object.getPrototypeOf(obj))
      : {}
  }

  var isProp = /^-?-?[a-z][a-z-_0-9]*$/i;

  var memoize = function (fn, cache) {
    if ( cache === void 0 ) { cache = {}; }

    return function (item) { return item in cache
      ? cache[item]
      : cache[item] = fn(item); };
  };

  function add(style, prop, values) {
    if (prop in style) // Recursively increase specificity
      { add(style, '!' + prop, values); }
    else
      { style[prop] = formatValues(prop, values); }
  }

  var vendorMap = Object.create(null, {});
  var vendorValuePrefix = Object.create(null, {});

  var vendorRegex = /^(o|O|ms|MS|Ms|moz|Moz|webkit|Webkit|WebKit)([A-Z])/;

  var appendPx = memoize(function (prop) {
    var el = document.createElement('div');

    try {
      el.style[prop] = '1px';
      el.style.setProperty(prop, '1px');
      return el.style[prop].slice(-3) === '1px' ? 'px' : ''
    } catch (err) {
      return ''
    }
  }, {
    flex: '',
    boxShadow: 'px',
    border: 'px',
    borderTop: 'px',
    borderRight: 'px',
    borderBottom: 'px',
    borderLeft: 'px'
  });

  function lowercaseFirst(string) {
    return string.charAt(0).toLowerCase() + string.slice(1)
  }

  function assign(obj, obj2) {
    for (var key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        obj[key] = typeof obj2[key] === 'string'
          ? obj2[key]
          : assign(obj[key] || {}, obj2[key]);
      }
    }
    return obj
  }

  function hyphenToCamelCase(hyphen) {
    return hyphen.slice(hyphen.charAt(0) === '-' ? 1 : 0).replace(/-([a-z])/g, function(match) {
      return match[1].toUpperCase()
    })
  }

  function camelCaseToHyphen(camelCase) {
    return camelCase.replace(/(\B[A-Z])/g, '-$1').toLowerCase()
  }

  function initials(camelCase) {
    return camelCase.charAt(0) + (camelCase.match(/([A-Z])/g) || []).join('').toLowerCase()
  }

  function objectToRules(style, selector, suffix, single) {
    if ( suffix === void 0 ) { suffix = ''; }

    var base = {};
    var extra = suffix.indexOf('&') > -1 && suffix.indexOf(',') === -1 ? '' : '&';
    var rules = [];

    Object.keys(style).forEach(function (prop) {
      if (prop.charAt(0) === '@')
        { rules.push(prop + '{' + objectToRules(style[prop], selector, suffix, single).join('') + '}'); }
      else if (typeof style[prop] === 'object')
        { rules = rules.concat(objectToRules(style[prop], selector, suffix + prop, single)); }
      else
        { base[prop] = style[prop]; }
    });

    if (Object.keys(base).length) {
      rules.unshift(
        ((single || (suffix.charAt(0) === ' ') ? '' : '&') + extra + suffix).replace(/&/g, selector).trim() +
        '{' + stylesToCss(base) + '}'
      );
    }

    return rules
  }

  var selectorSplit = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

  function stylesToCss(style) {
    return Object.keys(style).reduce(function (acc, prop) { return acc + propToString(prop.replace(/!/g, ''), style[prop]); }
    , '')
  }

  function propToString(prop, value) {
    prop = prop in vendorMap ? vendorMap[prop] : prop;
    return (vendorRegex.test(prop) ? '-' : '')
      + (cssVar(prop)
        ? prop
        : camelCaseToHyphen(prop)
      )
      + ':'
      + value
      + ';'
  }

  function formatValues(prop, value) {
    return Array.isArray(value)
      ? value.map(function (v) { return formatValue(prop, v); }).join(' ')
      : typeof value === 'string'
        ? formatValues(prop, value.split(' '))
        : formatValue(prop, value)
  }

  function formatValue(prop, value) {
    return value in vendorValuePrefix
      ? vendorValuePrefix[value]
      : value + (isNaN(value) || value === null || value === 0 || value === '0' || typeof value === 'boolean' || cssVar(prop) ? '' : appendPx(prop))
  }

  function cssVar(prop) {
    return prop.charAt(0) === '-' && prop.charAt(1) === '-'
  }

  var classPrefix = 'b' + ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3) +
                      ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3);

  var styleSheet = typeof document === 'object' && document.createElement('style');
  styleSheet && document.head && document.head.appendChild(styleSheet);
  styleSheet && (styleSheet.id = classPrefix);

  var sheet = styleSheet && styleSheet.sheet;

  var debug = false;
  var classes = Object.create(null, {});
  var rules = [];
  var count = 0;

  function setDebug(d) {
    debug = d;
  }

  function getSheet() {
    var content = rules.join('');
    rules = [];
    classes = Object.create(null, {});
    count = 0;
    return content
  }

  function getRules() {
    return rules
  }

  function insert(rule, index) {
    rules.push(rule);

    if (debug)
      { return styleSheet.textContent = rules.join('\n') }

    try {
      sheet && sheet.insertRule(rule, arguments.length > 1
        ? index
        : sheet.cssRules.length);
    } catch (e) {
      // Ignore thrown errors in eg. firefox for unsupported strings (::-webkit-inner-spin-button)
    }
  }

  function createClass(style) {
    var json = JSON.stringify(style);

    if (json in classes)
      { return classes[json] }

    var className = classPrefix + (++count)
        , rules = objectToRules(style, '.' + className);

    for (var i = 0; i < rules.length; i++)
      { insert(rules[i]); }

    classes[json] = className;

    return className
  }

  /* eslint no-invalid-this: 0 */

  var shorts = Object.create(null);

  function bss(input, value) {
    var b = chain(bss);
    input && assign(b.__style, parse.apply(null, arguments));
    return b
  }

  function setProp(prop, value) {
    Object.defineProperty(bss, prop, {
      configurable: true,
      value: value
    });
  }

  Object.defineProperties(bss, {
    __style: {
      configurable: true,
      writable: true,
      value: {}
    },
    valueOf: {
      configurable: true,
      writable: true,
      value: function() {
        return '.' + this.class
      }
    },
    toString: {
      configurable: true,
      writable: true,
      value: function() {
        return this.class
      }
    }
  });

  setProp('setDebug', setDebug);

  setProp('$keyframes', keyframes);
  setProp('$media', $media);
  setProp('$import', $import);
  setProp('$nest', $nest);
  setProp('getSheet', getSheet);
  setProp('getRules', getRules);
  setProp('helper', helper);
  setProp('css', css);
  setProp('classPrefix', classPrefix);

  function chain(instance) {
    var newInstance = Object.create(bss, {
      __style: {
        value: assign({}, instance.__style)
      },
      style: {
        enumerable: true,
        get: function() {
          var this$1 = this;

          return Object.keys(this.__style).reduce(function (acc, key) {
            if (typeof this$1.__style[key] === 'number' || typeof this$1.__style[key] === 'string')
              { acc[key.replace(/^!/, '')] = this$1.__style[key]; }
            return acc
          }, {})
        }
      }
    });

    if (instance === bss)
      { bss.__style = {}; }

    return newInstance
  }

  cssProperties.forEach(function (prop) {
    var vendor = prop.match(vendorRegex);
    if (vendor) {
      var unprefixed = lowercaseFirst(prop.replace(vendorRegex, '$2'));
      if (cssProperties.indexOf(unprefixed) === -1) {
        if (unprefixed === 'flexDirection')
          { vendorValuePrefix.flex = '-' + vendor[1].toLowerCase() + '-flex'; }

        vendorMap[unprefixed] = prop;
        setProp(unprefixed, setter(prop));
        setProp(short(unprefixed), bss[unprefixed]);
        return
      }
    }

    setProp(prop, setter(prop));
    setProp(short(prop), bss[prop]);
  });

  setProp('content', function Content(arg) {
    var b = chain(this);
    arg === null || arg === undefined || arg === false
      ? delete b.__style.content
      : b.__style.content = '"' + arg + '"';
    return b
  });

  Object.defineProperty(bss, 'class', {
    set: function(value) {
      this.__class = value;
    },
    get: function() {
      return this.__class || createClass(this.__style)
    }
  });

  function $media(value, style) {
    var b = chain(this);
    if (value)
      { b.__style['@media ' + value] = parse(style); }

    return b
  }

  function $import(value) {
    if (value && !/^('|"|url\('|url\(")/.test(value))
      { value = '"' + value + '"'; }

    if (value)
      { insert('@import ' + value + ';', 0); }

    return chain(this)
  }

  function $nest(selector, properties) {
    var b = chain(this);
    if (arguments.length === 1)
      { Object.keys(selector).forEach(function (x) { return addNest(b.__style, x, selector[x]); }); }
    else if (selector)
      { addNest(b.__style, selector, properties); }

    return b
  }

  function addNest(style, selector, properties) {
    var prop = selector.split(selectorSplit).map(function (x) {
      x = x.trim();
      return (x.charAt(0) === ':' || x.charAt(0) === '[' ? '' : ' ') + x
    }).join(',&');

    prop in style
      ? assign(style[prop], parse(properties))
      : style[prop] = parse(properties);
  }

  pseudos.forEach(function (name) { return setProp('$' + hyphenToCamelCase(name.replace(/:/g, '')), function Pseudo(value, style) {
      var b = chain(this);
      if (isTagged(value))
        { b.__style[name] = parse.apply(null, arguments); }
      else if (value || style)
        { b.__style[name + (style ? '(' + value + ')' : '')] = parse(style || value); }
      return b
    }); }
  );

  function setter(prop) {
    return function CssProperty(value) {
      var b = chain(this);
      if (!value && value !== 0)
        { delete b.__style[prop]; }
      else if (arguments.length > 0)
        { add(b.__style, prop, Array.prototype.slice.call(arguments)); }

      return b
    }
  }

  function css(selector, style) {
    if (arguments.length === 1)
      { Object.keys(selector).forEach(function (key) { return addCss(key, selector[key]); }); }
    else
      { addCss(selector, style); }

    return chain(this)
  }

  function addCss(selector, style) {
    objectToRules(parse(style), selector, '', true).forEach(function (rule) { return insert(rule); });
  }

  function helper(name, styling) {
    if (arguments.length === 1)
      { return Object.keys(name).forEach(function (key) { return helper(key, name[key]); }) }

    delete bss[name]; // Needed to avoid weird get calls in chrome

    if (typeof styling === 'function') {
      helper[name] = styling;
      Object.defineProperty(bss, name, {
        configurable: true,
        value: function Helper(input) {
          var b = chain(this);
          var result = isTagged(input)
            ? styling(raw(input, arguments))
            : styling.apply(null, arguments);
          assign(b.__style, result.__style);
          return b
        }
      });
    } else {
      helper[name] = parse(styling);
      Object.defineProperty(bss, name, {
        configurable: true,
        get: function() {
          var b = chain(this);
          assign(b.__style, parse(styling));
          return b
        }
      });
    }
  }

  bss.helper('$animate', function (value, props) { return bss.animation(bss.$keyframes(props) + ' ' + value); }
  );

  function short(prop) {
    var acronym = initials(prop)
        , short = popular[acronym] && popular[acronym] !== prop ? prop : acronym;

    shorts[short] = prop;
    return short
  }

  var stringToObject = memoize(function (string) {
    var last = ''
      , prev;

    return string.trim().replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*(?![^("]*[)"])/g, '').split(/;(?![^("]*[)"])|\n/).reduce(function (acc, line) {
      if (!line)
        { return acc }
      line = last + line.trim();
      var ref = line.replace(/[ :]+/, ' ').split(' ');
      var key = ref[0];
      var tokens = ref.slice(1);

      last = line.charAt(line.length - 1) === ',' ? line : '';
      if (last)
        { return acc }

      if (line.charAt(0) === ',' || !isProp.test(key)) {
        acc[prev] += ' ' + line;
        return acc
      }

      if (!key)
        { return acc }

      var prop = key.charAt(0) === '-' && key.charAt(1) === '-'
        ? key
        : hyphenToCamelCase(key);

      prev = shorts[prop] || prop;

      if (key in helper) {
        typeof helper[key] === 'function'
          ? assign(acc, helper[key].apply(helper, tokens).__style)
          : assign(acc, helper[key]);
      } else if (prop in helper) {
        typeof helper[prop] === 'function'
          ? assign(acc, helper[prop].apply(helper, tokens).__style)
          : assign(acc, helper[prop]);
      } else if (tokens.length > 0) {
        add(acc, prev, tokens);
      }

      return acc
    }, {})
  });

  var count$1 = 0;
  var keyframeCache = {};

  function keyframes(props) {
    var content = Object.keys(props).reduce(function (acc, key) { return acc + key + '{' + stylesToCss(parse(props[key])) + '}'; }
    , '');

    if (content in keyframeCache)
      { return keyframeCache[content] }

    var name = classPrefix + count$1++;
    keyframeCache[content] = name;
    insert('@keyframes ' + name + '{' + content + '}');

    return name
  }

  function parse(input, value) {
    var obj;

    if (typeof input === 'string') {
      if (typeof value === 'string' || typeof value === 'number')
        { return (( obj = {}, obj[input] = value, obj )) }

      return stringToObject(input)
    } else if (isTagged(input)) {
      return stringToObject(raw(input, arguments))
    }

    return input.__style || sanitize(input)
  }

  function isTagged(input) {
    return Array.isArray(input) && typeof input[0] === 'string'
  }

  function raw(input, args) {
    var str = '';
    for (var i = 0; i < input.length; i++)
      { str += input[i] + (args[i + 1] || args[i + 1] === 0 ? args[i + 1] : ''); }
    return str
  }

  function sanitize(styles) {
    return Object.keys(styles).reduce(function (acc, key) {
      var value = styles[key];
      key = shorts[key] || key;

      if (!value && value !== 0 && value !== '')
        { return acc }

      if (key === 'content' && value.charAt(0) !== '"')
        { acc[key] = '"' + value + '"'; }
      else if (typeof value === 'object')
        { acc[key] = sanitize(value); }
      else
        { add(acc, key, value); }

      return acc
    }, {})
  }

  var templateObject$5 = Object.freeze(["\n            transition all 0.3s\n          "]);
  var templateObject$4 = Object.freeze(["\n      position absolute\n      top 0\n      left 0\n    "]);
  var templateObject$3 = Object.freeze(["o 0"]);
  var templateObject$2 = Object.freeze(["\n      ff monospace\n      fs 10\n      zi 1\n      p 2 4\n      bc white\n      position absolute\n      white-space nowrap\n      br 3\n      bs 0 0 3px rgba(0,0,0,.5)\n      t ", "\n      l ", "\n    "]);
  var templateObject$1 = Object.freeze(["\n      o 0\n      transform scale(2)\n    "]);
  var templateObject = Object.freeze(["\n    position fixed\n    z-index 200000\n    pointer-events none\n    transition opacity 0.3s\n    transform-origin ", "px ", "px\n    l 0\n    b 0\n    r 0\n    t 0\n  "]);

  var model = {
    show: false,
    get rect() {
      var rect = model.over.getBoundingClientRect();
      return rect && {
        tag: model.over.tagName.toLowerCase(),
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom
      }
    }
  };

  var locationRegex = /(.*)[ @(](.*):([\d]*):([\d]*)/i;
  function parseStackLine(string) {
    var ref = (' ' + string.trim()).match(locationRegex) || [];
    var match = ref[0];
    var func = ref[1];
    var url = ref[2];
    var line = ref[3];
    var column = ref[4];

    return match && {
      function: func.trim().replace(/^(global code|at) ?/, ''),
      url: url,
      line: parseInt(line),
      column: parseInt(column)
    }
  }

  window.addEventListener('click', function(e) {
    if (!model.show)
      { return }

    e.preventDefault();
    e.stopPropagation();

    var stack;
    var el = e.target;
    while (el.parentNode && !stack) {
      stack = el.stackTrace;
      el = el.parentNode;
    }
    if (stack) {
      model.show = false;
      var parsed = stack.split('\n').map(parseStackLine).filter(function (a) { return a; });
      if (parsed.length > 2 && parsed[2].url) {
        ubre.publish('goto', parsed[2]);
        e.stopPropagation();
        e.preventDefault();
        mithril.redraw();
      }
    }
  }, true);

  window.addEventListener('mouseover', function (e) {
    model.over = e.target;
    model.show && mithril.redraw();
  });

  window.addEventListener('keydown', function (e) {
    e.key === 'Shift' && (model.shift = true);
    e.key === 'Meta' && (model.meta = true);
    e.key === 'Control' && (model.control = true);
    update();
  }, true);

  window.addEventListener('keyup', function (e) {
    e.key === 'Shift' && (model.shift = false);
    e.key === 'Meta' && (model.meta = false);
    e.key === 'Control' && (model.control = false);
    update();
  }, true);

  window.addEventListener('blur', function (e) {
    model.show = false;
    mithril.redraw();
  });

  function update() {
    var show = model.shift && (model.meta || model.control);
    if (model.show !== show) {
      model.show = show;
      mithril.redraw();
    }
  }

  var div = document.createElement('div');
  div.id = 'wright_inspect';
  document.documentElement.appendChild(div);
  mithril.mount(div, { view: function () { return model.show && model.rect && mithril('div' + bss(templateObject, model.rect.left + model.rect.width / 2, model.rect.top + model.rect.height / 2).$animate('0.3s', {
      from: bss(templateObject$1)
    }), {
      onbeforeremove: function (ref) {
        var dom = ref.dom;

        return new Promise(function (res) {
        dom.style.opacity = 0;
        setTimeout(res, 300);
      });
      }
    },
      mithril('span' + bss(templateObject$2, model.rect.bottom + 8, model.rect.left).$animate('0.3s', { from: bss(templateObject$3) }),
        Math.round(model.rect.left) + ',' + Math.round(model.rect.top) + ' <' + model.rect.tag + '> ' + Math.round(model.rect.width) + 'x' + Math.round(model.rect.height)
      ),
      mithril('svg' + bss(templateObject$4), {
        width: '100%',
        height: '100%'
      },
        mithril('defs',
          mithril('mask#hole',
            mithril('rect', {
              width: 10000,
              height: 10000,
              fill: 'white'
            }),
            mithril('rect' + bss(templateObject$5), {
              fill: 'black',
              rx: 4,
              ry: 4,
              width: model.rect.width + 8,
              height: model.rect.height + 8,
              x: model.rect.left - 4,
              y: model.rect.top - 4
            })
          )
        ),
        mithril('rect', {
          fill: 'rgba(0, 150, 255, 0.5)',
          width: '100%',
          height: '100%',
          mask: 'url(#hole)'
        })
      )
    ); }
  });

  window.onerror = function(msg, file, line, col, err) { // eslint-disable-line
    err = (!err || typeof err === 'string') ? { message: msg || err } : err;

    err.stack = (!err.stack || String(err) === err.stack)
      ? ('at ' + (file || 'unknown') + ':' + line + ':' + col)
      : err.stack;

    ubre.publish('error', {
      message: err.message || String(err),
      error: err,
      stack: err.stack
    });
  };

  var el = document.getElementById('wrightSocket');
  el && el.parentNode.removeChild(el);

}());
//# sourceMappingURL=wright.js.map
