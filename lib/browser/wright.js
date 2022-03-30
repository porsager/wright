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

    var browser = typeof window !== 'undefined' && window.WebSocket;
    if (browser) {
      WebSocket = WebSocket || window.WebSocket;
      typeof window !== 'undefined'
        && typeof window.addEventListener === 'function'
        && window.addEventListener('online', function () { return connect(); });
    }

    if (!WebSocket)
      { throw new Error('Please supply a websocket library to use') }

    if (!options)
      { options = {}; }

    var connection = null
      , reconnecting = false
      , reconnectTimer = null
      , heartbeatTimer = null
      , openTimer = null
      , binaryType = null
      , closed = false
      , reconnectDelay = 0;

    var listeners = {};
    var listenerHandlers = {};
    var ons = {};
    var onHandlers = {};

    var pws = {
      CONNECTING: 0,
      OPEN      : 1,
      CLOSING   : 2,
      CLOSED    : 3,
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
        closed = true;
        connection && connection.close.apply(connection, arguments);
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
      closed = reconnecting = false;
      clearTimeout(reconnectTimer);

      if (connection && connection.readyState !== 3) {
        close(4665, 'Manual connect initiated');
        return connect(url)
      }

      url && (pws.url = url);
      url = typeof pws.url === 'function'
        ? pws.url(pws)
        : pws.url;

      connection = browser
        ? protocols
          ? new WebSocket(url, protocols)
          : new WebSocket(url)
        : new WebSocket(url, protocols, options);

      typeof connection.on === 'function'
        ? connection.on('error', onerror)
        : (connection.onerror = onerror);

      connection.onclose = onclose;
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

    function onclose(event) {
      event.reconnectDelay = reconnect();
      pws.onclose && pws.onclose.apply(pws, arguments);
      clearTimeout(heartbeatTimer);
      clearTimeout(openTimer);
    }

    function onerror() {
      pws.onerror && pws.onerror.apply(pws, arguments);
    }

    function onopen(event) {
      pws.onopen && pws.onopen.apply(pws, arguments);
      heartbeat();
      openTimer = setTimeout(function () { return pws.retries = 0; }, reconnectDelay || 0);
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
      if (closed)
        { return }

      if (reconnecting)
        { return reconnectDelay - (Date.now() - reconnecting) }

      if (pws.maxRetries && pws.connects >= pws.maxRetries)
        { return }

      reconnecting = Date.now();
      reconnectDelay = Math.ceil(pws.nextReconnectDelay(pws.retries++));
      reconnectTimer = setTimeout(connect, reconnectDelay);

      return reconnectDelay
    }

    function close(code, reason) {
      connection.onclose = connection.onopen = connection.onerror = connection.onmessage = null;
      Object.keys(listenerHandlers).forEach(function (event) {
        listenerHandlers[event].forEach(function (handler) { return connection.removeEventListener(event, handler); });
      });
      Object.keys(onHandlers).forEach(function (event) {
        onHandlers[event].forEach(function (handler) { return connection.removeListener(event, handler); });
      });
      connection.close();
      connection = null;
      var event = closeEvent(code, reason);
      onclose(event);
      listenerHandlers.close && listenerHandlers.close.forEach(function (handler) { return handler(event); });
      onHandlers.close && onHandlers.close.forEach(function (handler) { return handler(code, reason, reconnectDelay); });
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

  var noop = function () { /* noop */ };

  function Ubre(ref) {
    var send = ref.send; if ( send === void 0 ) send = noop;
    var receive = ref.receive; if ( receive === void 0 ) receive = noop;
    var open = ref.open; if ( open === void 0 ) open = false;
    var deserialize = ref.deserialize; if ( deserialize === void 0 ) deserialize = JSON.parse;
    var serialize = ref.serialize; if ( serialize === void 0 ) serialize = JSON.stringify;
    var unwrapError = ref.unwrapError; if ( unwrapError === void 0 ) unwrapError = unwrapErr;

    var subscriptions = MapSet()
        , subscribers = MapSet()
        , responses = MapSet()
        , queue = MapSet()
        , requests = Map()
        , publishes = Map()
        , handlers = Map();

    var i = 0;

    function subscribe(from, ref) {
      var subscribe = ref.subscribe;

      !subscribers.has(subscribe) && ubre.onTopicStart(subscribe);
      subscribers.add(subscribe, from);
      ubre.onSubscribe(subscribe, from);
    }

    function unsubscribe(from, ref) {
      var unsubscribe = ref.unsubscribe;

      subscribers.remove(unsubscribe, from);
      !subscribers.has(unsubscribe) && ubre.onTopicEnd(unsubscribe);
      ubre.onUnsubscribe(unsubscribe, from);
    }

    function publish(from, ref) {
      var publish = ref.publish;
      var body = ref.body;

      subscriptions.has(publish) && subscriptions.get(publish).forEach(function (s) { return (
        (!s.target || s.target === from) && s.fn(body, from)
      ); });
    }

    function request(from, ref) {
      var id = ref.id;
      var request = ref.request;
      var body = ref.body;

      if (!handlers.has(request))
        { return forward({ fail: id, body: 'NotFound' }, from) }

      responses.add(from, { id: id });
      new Promise(function (resolve) { return resolve(handlers.get(request)(body, from)); })
      .then(function (body) { return sendResponse(from, id, { success: id, body: body }); })
      .catch(function (body) { return sendResponse(from, id, { fail: id, body: unwrapError(body) }); });
    }

    function success(from, ref) {
      var success = ref.success;
      var body = ref.body;

      requests.has(success) && requests.get(success).resolve(body);
      requests.delete(success);
    }

    function fail(from, ref) {
      var fail = ref.fail;
      var body = ref.body;

      requests.has(fail) && requests.get(fail).reject(body);
      requests.delete(fail);
    }

    function sendResponse(target, id, message) {
      if (open) {
        forward(message, target),
        responses.remove(target, id);
      } else {
        queue.add(target, { id: id, message: message });
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
      var x = deserialize(message);
      'subscribe'            in x ? subscribe(from, x) :
      'unsubscribe'          in x ? unsubscribe(from, x) :
      'publish'              in x ? publish(from, x) :
      'request' in x && 'id' in x ? request(from, x) :
      'success'              in x ? success(from, x) :
      'fail'                 in x && fail(from, x);
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

      id = id || ++i;
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

    ubre.open = function () {
      open = true;

      subscriptions.forEach(function (s, topic) { return s.forEach(function (m) { return !m.sent && (
        forward({ subscribe: topic, body: m.body }, m.target),
        m.sent = true
      ); }); });

      requests.forEach(function (r, id) { return !r.sent && (
        forward({ request: r.request, id: id, body: r.body }, r.target),
        r.sent = true
      ); });

      queue.forEach(function (ref, from) {
          var id = ref.id;
          var message = ref.message;

          return sendResponse(from, id, message);
      }
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
        subscriptions.forEach(function (s) { return s.forEach(function (ref) {
            var target = ref.target;

            return target === this$1.target && s.delete(target);
          }
        ); });
        requests.forEach(function (r, id) { return r.target === this$1.target && (
          r.reject(new Error('closed')),
          requests.delete(id)
        ); });
        responses.delete(this.target);
        queue.delete(this.target);
      } else {
        open = false;
        subscriptions.forEach(function (s) { return s.forEach(function (m) { return m.sent = false; }); });
      }
    };

    receive(ubre.message);

    return ubre
  }

  function MapSet() {
    var map = Map();

    return {
      add: function (key, item) { return (map.get(key) || map.set(key, Set()).get(key)).add(item); },
      has: map.has.bind(map),
      get: map.get.bind(map),
      delete: map.delete.bind(map),
      clear: map.clear.bind(map),
      forEach: map.forEach.bind(map),
      removeItems: function (item) { return map.forEach(function (set) { return set.delete(item); }); },
      remove: function (key, item) {
        if (!map.has(key))
          { return }

        var set = map.get(key);
        set.delete(item);
        set.size === 0 && map.delete(key);
      }
    }
  }

  function Map() {
    var keys = []
      , values = [];

    var map = {
      has: function (x) { return keys.indexOf(x) !== -1; },
      get: function (x) { return values[keys.indexOf(x)]; },
      set: function (x, v) { return (keys.push(x), values.push(v), map); },
      forEach: function (fn) { return keys.forEach(function (k, i) { return fn(values[i], k, map); }); },
      clear: function () { return (keys = [], values = [], undefined); },
      delete: function (x) {
        var index = keys.indexOf(x);
        if (index > -1) {
          keys.splice(index, 1);
          values.splice(index, 1);
        }
      }
    };

    return map
  }

  function Set() {
    var values = [];

    var set = {
      add: function (x) { return (values.indexOf(x) === -1 && values.push(x), set); },
      clear: function () { return (values = [], undefined); },
      delete: function (x) { return values.indexOf(x) !== -1 ? (values.splice(values.indexOf(x), 1), true) : false; },
      forEach: function (fn) { return values.forEach(function (v) { return fn(v, v, set); }); },
      has: function (x) { return values.indexOf(x) !== -1; }
    };

    Object.defineProperty(set, 'size', {
      get: function get() {
        return values.length
      }
    });

    return set
  }

  function copy(o, seen) {
    if ( seen === void 0 ) seen = [];

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
