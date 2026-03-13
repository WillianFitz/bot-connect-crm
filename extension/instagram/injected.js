(function () {
  if (window.__igPS) return;
  window.__igPS = true;

  // ── Visibility spoof (keeps IG APIs active in background/minimised tabs) ──
  try {
    Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
    Object.defineProperty(document, "hidden",          { get: () => false,     configurable: true });
    document.hasFocus = () => true;
    document.addEventListener("visibilitychange", e => e.stopImmediatePropagation(), true);
  } catch(e) {}

  var _origFetch = window.fetch;

  // ── URL matchers ──────────────────────────────────────────────────────────
  // Old REST endpoint:  /api/v1/friendships/<uid>/followers/
  // New GraphQL endpoints used by IG Web:
  //   POST /api/graphql   (application/x-www-form-urlencoded, body contains "followers")
  //   GET/POST /ajax/bz   (comet/relay, same body pattern)
  function mightHaveFollowers(url) {
    if (!url) return false;
    // Classic REST
    if (url.includes("/followers/") && !url.includes("following")) return true;
    // GraphQL relay — we check body in the fetch wrapper below
    if (url.includes("/api/graphql") || url.includes("/ajax/bz")) return true;
    return false;
  }

  // ── Response parsers ──────────────────────────────────────────────────────
  function extractFromREST(data, url) {
    // { users: [{username, ...}], next_max_id: "..." }
    var users = [];
    (data.users || []).forEach(function(u) { if (u && u.username) users.push(u.username); });
    var hasMore = !!(data.next_max_id);
    return { users: users, hasMore: hasMore };
  }

  // GraphQL shape (as seen in 2024-2025 IG Web):
  //   data.xdt_api__v1__friendships__user_id__followers__connection.edges[].node.username
  // Also sometimes: data.xdt_api__v1__discover__chaining.users[].username
  // We walk the tree generically to be resilient to future renames.
  function extractFromGraphQL(data) {
    var users = [];
    var hasMore = false;

    // Walk any key that ends with __followers__connection or similar
    function walk(obj, depth) {
      if (!obj || typeof obj !== "object" || depth > 8) return;
      // Direct username hit (node shape)
      if (obj.username && typeof obj.username === "string") {
        users.push(obj.username);
        return;
      }
      // edges array
      if (Array.isArray(obj.edges)) {
        obj.edges.forEach(function(e) { walk(e.node || e, depth + 1); });
        // page_info
        if (obj.page_info && obj.page_info.has_next_page) hasMore = true;
        return;
      }
      // users array (legacy shape nested inside graphql)
      if (Array.isArray(obj.users)) {
        obj.users.forEach(function(u) { if (u && u.username) users.push(u.username); });
        if (obj.next_max_id) hasMore = true;
        return;
      }
      // Recurse into object keys
      Object.keys(obj).forEach(function(k) {
        // Only follow keys that look followers-related to avoid scanning the whole tree
        var lk = k.toLowerCase();
        if (lk.includes("follower") || lk.includes("friend") ||
            lk.includes("user") || lk.includes("edge") ||
            lk.includes("node") || lk.includes("data") ||
            lk.includes("connection") || lk === "xdt_api__v1__friendships") {
          walk(obj[k], depth + 1);
        }
      });
    }

    walk(data, 0);
    // Deduplicate
    users = Array.from(new Set(users));
    return { users: users, hasMore: hasMore };
  }

  function handleResponse(data, url, isGraphQL) {
    if (!data) return;

    // userId from REST URL
    if (url) {
      var m = url.match(/friendships\/(\d+)\/followers/);
      if (m) window.postMessage({ type: "__IG_EXTRACTOR_USERID", userId: m[1] }, "*");
    }

    var result = isGraphQL ? extractFromGraphQL(data) : extractFromREST(data, url);

    if (result.users.length) {
      window.postMessage({ type: "__IG_EXTRACTOR_USERS", usernames: result.users }, "*");
    }

    // Always fire PAGE_ARRIVED so the content-script's waitForNextPage unblocks
    window.postMessage({
      type: "__IG_EXTRACTOR_PAGE_ARRIVED",
      count: result.users.length,
      hasMore: result.hasMore,
    }, "*");
  }

  // ── Fetch interceptor ─────────────────────────────────────────────────────
  window.fetch = async function() {
    var args = arguments;
    var res = await _origFetch.apply(this, args);
    try {
      var url = typeof args[0] === "string" ? args[0]
              : (args[0] && args[0].url) ? args[0].url : "";

      if (!mightHaveFollowers(url)) return res;

      var isREST = url.includes("/followers/") && !url.includes("/api/graphql") && !url.includes("/ajax/bz");
      var isGraphQL = !isREST;

      // For GraphQL we also need to verify the request body mentions followers
      // (these endpoints handle ALL queries, not just followers)
      if (isGraphQL) {
        var bodyStr = "";
        try {
          var reqInit = args[1];
          if (reqInit && reqInit.body) {
            bodyStr = typeof reqInit.body === "string" ? reqInit.body
                    : (reqInit.body instanceof URLSearchParams) ? reqInit.body.toString() : "";
          }
          // Also check Request object
          if (!bodyStr && args[0] && args[0].clone) {
            // Can't read body of Request after it's consumed, skip this case
          }
        } catch(e) {}

        // If body is available and doesn't mention followers, skip
        if (bodyStr && !bodyStr.toLowerCase().includes("follower")) return res;
      }

      res.clone().json()
        .then(function(d) { handleResponse(d, url, isGraphQL); })
        .catch(function() {});
    } catch(e) {}
    return res;
  };

  // ── XHR interceptor ───────────────────────────────────────────────────────
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR();
    var _url = "";
    var _method = "";
    var _sentBody = "";

    xhr.open = (function(origOpen) {
      return function(method, url) {
        _url = url || "";
        _method = (method || "").toUpperCase();
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
      // Body filter for GraphQL XHR
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
