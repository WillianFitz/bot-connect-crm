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

  function isFollowers(url) {
    return url && url.includes("/followers/") && !url.includes("following");
  }

  function handleFollowersResponse(data, url) {
    // Captura userId da URL
    if (url) {
      var m = url.match(/friendships\/(\d+)\/followers/);
      if (m) window.postMessage({ type: "__IG_EXTRACTOR_USERID", userId: m[1] }, "*");
    }

    // Extrai usernames
    var users = [];
    try {
      (data?.users || []).forEach(u => { if (u?.username) users.push(u.username); });
    } catch(e) {}

    if (users.length)
      window.postMessage({ type: "__IG_EXTRACTOR_USERS", usernames: users }, "*");

    // Reporta que uma página chegou (com cursor para referência interna)
    window.postMessage({
      type: "__IG_EXTRACTOR_PAGE_ARRIVED",
      count: users.length,
      hasMore: !!(data?.next_max_id),
    }, "*");
  }

  // Intercepta fetch — apenas observa, nunca chama nada manualmente
  window.fetch = async function() {
    var res = await _origFetch.apply(this, arguments);
    var url = typeof arguments[0] === "string" ? arguments[0] : (arguments[0]?.url || "");
    if (isFollowers(url)) {
      res.clone().json().then(d => handleFollowersResponse(d, url)).catch(() => {});
    }
    return res;
  };

  // Intercepta XHR
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR(), _url = "";
    xhr.open = (function(o) {
      return function(m, u) { _url = u || ""; return o.apply(this, arguments); };
    })(xhr.open.bind(xhr));
    xhr.addEventListener("load", function() {
      if (isFollowers(_url)) {
        try { handleFollowersResponse(JSON.parse(xhr.responseText), _url); } catch(e) {}
      }
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();
