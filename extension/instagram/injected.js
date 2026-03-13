(function () {
  if (window.__igPS) return;
  window.__igPS = true;

  try {
    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
    Object.defineProperty(document, "hidden",          { get: () => false,     configurable: true });
    document.hasFocus = () => true;
    document.addEventListener("visibilitychange", e => e.stopImmediatePropagation(), true);
  } catch(e) {}

  var _origFetch = window.fetch;

  // Captura REST (/api/v1/friendships/<uid>/followers/) E GraphQL (/api/graphql, /ajax/bz)
  function mightHaveFollowers(url) {
    if (!url) return false;
    if (url.includes("/followers/") && !url.includes("following")) return true;
    if (url.includes("/api/graphql") || url.includes("/ajax/bz")) return true;
    return false;
  }

  // Parser REST: { users: [{username}], next_max_id }
  function extractFromREST(data) {
    var users = [];
    (data.users || []).forEach(function(u) { if (u && u.username) users.push(u.username); });
    return { users: users, hasMore: !!(data.next_max_id) };
  }

  // Parser GraphQL: percorre a árvore procurando usernames em qualquer formato
  // Suporta edges[].node.username, users[].username e variações futuras
  function extractFromGraphQL(data) {
    var users = [];
    var hasMore = false;

    function walk(obj, depth) {
      if (!obj || typeof obj !== "object" || depth > 8) return;
      if (obj.username && typeof obj.username === "string") {
        users.push(obj.username);
        return;
      }
      if (Array.isArray(obj.edges)) {
        obj.edges.forEach(function(e) { walk(e.node || e, depth + 1); });
        if (obj.page_info && obj.page_info.has_next_page) hasMore = true;
        return;
      }
      if (Array.isArray(obj.users)) {
        obj.users.forEach(function(u) { if (u && u.username) users.push(u.username); });
        if (obj.next_max_id) hasMore = true;
        return;
      }
      Object.keys(obj).forEach(function(k) {
        var lk = k.toLowerCase();
        if (lk.includes("follower") || lk.includes("friend") ||
            lk.includes("user") || lk.includes("edge") ||
            lk.includes("node") || lk.includes("data") ||
            lk.includes("connection")) {
          walk(obj[k], depth + 1);
        }
      });
    }

    walk(data, 0);
    users = Array.from(new Set(users));
    return { users: users, hasMore: hasMore };
  }

  function handleResponse(data, url, isGraphQL) {
    if (!data) return;

    if (url) {
      var m = url.match(/friendships\/(\d+)\/followers/);
      if (m) window.postMessage({ type: "__IG_EXTRACTOR_USERID", userId: m[1] }, "*");
    }

    var result = isGraphQL ? extractFromGraphQL(data) : extractFromREST(data);

    if (result.users.length) {
      window.postMessage({ type: "__IG_EXTRACTOR_USERS", usernames: result.users }, "*");
    }

    window.postMessage({
      type: "__IG_EXTRACTOR_PAGE_ARRIVED",
      count: result.users.length,
      hasMore: result.hasMore,
    }, "*");
  }

  // ── Intercepta fetch ──────────────────────────────────────────────────────
  window.fetch = async function() {
    var args = arguments;
    var res = await _origFetch.apply(this, args);
    try {
      var url = typeof args[0] === "string" ? args[0]
              : (args[0] && args[0].url) ? args[0].url : "";

      if (!mightHaveFollowers(url)) return res;

      var isREST = url.includes("/followers/") && !url.includes("/api/graphql") && !url.includes("/ajax/bz");
      var isGraphQL = !isREST;

      // Para GraphQL: filtra pelo body da requisição (evita interceptar queries não relacionadas)
      if (isGraphQL) {
        var bodyStr = "";
        try {
          var reqInit = args[1];
          if (reqInit && reqInit.body) {
            bodyStr = typeof reqInit.body === "string" ? reqInit.body
                    : (reqInit.body instanceof URLSearchParams) ? reqInit.body.toString() : "";
          }
        } catch(e) {}
        if (bodyStr && !bodyStr.toLowerCase().includes("follower")) return res;
      }

      res.clone().json()
        .then(function(d) { handleResponse(d, url, isGraphQL); })
        .catch(function() {});
    } catch(e) {}
    return res;
  };

  // ── Intercepta XHR ───────────────────────────────────────────────────────
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR();
    var _url = "";
    var _sentBody = "";

    xhr.open = (function(origOpen) {
      return function(method, url) {
        _url = url || "";
        return origOpen.apply(this, arguments);
      };
    })(xhr.open.bind(xhr));

    xhr.send = (function(origSend) {
      return function(body) {
        if (body && typeof body === "string") _sentBody = body;
        return origSend.apply(this, arguments);
      };
    })(xhr.send.bind(xhr));

    xhr.addEventListener("load", function() {
      if (!mightHaveFollowers(_url)) return;
      var isREST = _url.includes("/followers/") && !_url.includes("/api/graphql") && !_url.includes("/ajax/bz");
      var isGraphQL = !isREST;
      if (isGraphQL && _sentBody && !_sentBody.toLowerCase().includes("follower")) return;
      try {
        handleResponse(JSON.parse(xhr.responseText), _url, isGraphQL);
      } catch(e) {}
    });

    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();
