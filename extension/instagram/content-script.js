if (typeof window.__igExtractorLoaded === "undefined") {
  window.__igExtractorLoaded = true;

  const _captured  = new Set();
  let _userId      = null;
  let _lastPageTs  = 0;
  let _lastPageHasMore = true;

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    if (ev.data?.type === "__IG_EXTRACTOR_USERS")
      (ev.data.usernames || []).forEach(u => { if (u) _captured.add(u); });
    if (ev.data?.type === "__IG_EXTRACTOR_USERID" && ev.data.userId)
      _userId = ev.data.userId;
    if (ev.data?.type === "__IG_EXTRACTOR_PAGE_ARRIVED") {
      _lastPageTs = Date.now();
      _lastPageHasMore = ev.data.hasMore;
    }
  });

  // Injeta injected.js no contexto da página (necessário para interceptar fetch/XHR do Instagram)
  // Usa window.__igFetchPatched como guard real — não depende do elemento no DOM
  function injectPageScript() {
    if (window.__igFetchPatched) return; // já interceptado, não precisa reinjetar
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("injected.js");
    s.onload  = () => { console.log("[IGExtractor] injected.js carregado OK"); s.remove(); };
    s.onerror = () => { console.error("[IGExtractor] ERRO ao carregar injected.js — verifique web_accessible_resources no manifest"); };
    (document.head || document.documentElement || document.body).appendChild(s);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitFor(fn, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = typeof fn === "function" ? fn() : document.querySelector(fn);
      if (v) return v;
      await sleep(300);
    }
    return null;
  }

  async function waitForGrowth(size, timeout = 8000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (_captured.size > size) return true;
      await sleep(200);
    }
    return false;
  }

  async function waitForNextPage(timeout = 12000) {
    const marker = _lastPageTs;
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (_lastPageTs > marker) return true;
      await sleep(200);
    }
    return false;
  }

  const RESERVED = new Set(["explore","reels","stories","direct","accounts",
    "p","tv","reel","ar","challenges","login","signup","about","press",
    "api","blog","jobs","privacy","legal","cookie_policy"]);

  async function dismissPopups() {
    for (let i = 0; i < 4; i++) {
      const dialogs = document.querySelectorAll("div[role='dialog'],div[role='alertdialog']");
      if (!dialogs.length) break;
      for (const dlg of dialogs) {
        const btn = Array.from(dlg.querySelectorAll("button,div[role='button']")).find(b => {
          const t = (b.textContent || "").toLowerCase().trim();
          return t.includes("agora não") || t.includes("not now") || t.includes("fechar") ||
                 t.includes("close") || t.includes("skip") || t.includes("pular") ||
                 t.includes("cancelar") || t.includes("cancel");
        });
        if (btn) { btn.click(); await sleep(600); continue; }
      }
      await sleep(400);
    }
  }

  const PAGE_HREFS = new Set(["/", "/explore/", "/reels/", "/direct/inbox/", "/direct/"]);

  function getFollowerLinks() {
    const all = Array.from(document.querySelectorAll("a[href^='/'][role='link'], a[href^='/'][tabindex]"))
      .filter(a => {
        const href = a.getAttribute("href") || "";
        if (!href || PAGE_HREFS.has(href)) return false;
        if (href.includes("stories") || href.includes("explore") ||
            href.includes("followers") || href.includes("following")) return false;
        return /^\/[^/]+\/?$/.test(href);
      });
    const seen = new Map();
    all.forEach(a => seen.set(a.getAttribute("href"), a));
    return Array.from(seen.values());
  }

  async function collectUsernames(targetCount, baseProfile) {
    // Zera tudo a cada rodada
    _captured.clear();
    _lastPageHasMore = true;
    _lastPageTs = Date.now();
    _userId = null;

    // Injeta e aguarda o interceptor estar ativo
    injectPageScript();
    await sleep(2000); // tempo para injected.js carregar e patchear o fetch

    // Se não carregou, tenta novamente
    if (!window.__igFetchPatched) {
      console.warn("[IGExtractor] injected.js não carregou na primeira tentativa, retentando...");
      injectPageScript();
      await sleep(2000);
    }

    console.log("[IGExtractor] Iniciando para", baseProfile, "target:", targetCount,
                "| fetchPatched:", !!window.__igFetchPatched);

    await waitFor("header", 12000);
    await sleep(1500);
    await dismissPopups();

    let dlg = document.querySelector("div[role='dialog']");
    if (!dlg) {
      const trigger = await waitFor(() => {
        const byHref = document.querySelector("a[href$='/followers/']")
                    || document.querySelector("a[href*='/followers/']");
        if (byHref) return byHref;
        return Array.from(document.querySelectorAll("a,button,span,div[role='button']"))
          .find(el => {
            const t = (el.textContent || "").toLowerCase().trim();
            return (t.includes("seguidores") || t.includes("followers")) &&
                   t.length < 60 && el.offsetParent !== null;
          }) || null;
      }, 20000);

      if (!trigger) throw new Error("Botão de seguidores não encontrado.");
      trigger.click();
      dlg = await waitFor("div[role='dialog']", 10000);
    }

    if (!dlg) throw new Error("Modal de seguidores não abriu.");

    await waitForGrowth(0, 10000);
    console.log("[IGExtractor] Batch inicial:", _captured.size, "users");

    let stale = 0;
    const MAX_STALE = 10;

    while (_captured.size < targetCount) {
      if (!_lastPageHasMore) {
        console.log("[IGExtractor] Fim da lista (hasMore=false)");
        break;
      }

      const prevSize = _captured.size;
      const links = getFollowerLinks();

      const viewportH = window.innerHeight;
      let targetLink = null;
      for (const a of links) {
        const rect = a.getBoundingClientRect();
        if (rect.top > viewportH - 50) { targetLink = a; break; }
      }
      if (!targetLink) targetLink = links[links.length - 1];

      if (targetLink) {
        targetLink.scrollIntoView({ behavior: "smooth", block: "center" });
        const modal = targetLink.closest("div[role='dialog']");
        if (modal) {
          const scrollable = Array.from(modal.querySelectorAll("*")).find(el =>
            el.scrollHeight > el.clientHeight && el.clientHeight > 100
          );
          if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
        }
        console.log(`[IGExtractor] scroll | links: ${links.length} | total: ${_captured.size}/${targetCount}`);
      } else {
        document.documentElement.scrollTop = document.documentElement.scrollHeight;
        console.log(`[IGExtractor] scroll fallback | total: ${_captured.size}/${targetCount}`);
      }

      const pageArrived = await waitForNextPage(12000);
      await sleep(900 + Math.floor(Math.random() * 600));

      const grew = _captured.size > prevSize;
      console.log(`[IGExtractor] grew: ${grew} | pageArrived: ${pageArrived} | total: ${_captured.size}`);

      if (!grew && !pageArrived) {
        stale++;
        console.log(`[IGExtractor] stale: ${stale}/${MAX_STALE}`);
        if (stale >= MAX_STALE) { console.log("[IGExtractor] Max stale — fim"); break; }
        await sleep(2000 + stale * 500);
      } else {
        stale = 0;
      }
    }

    console.log("[IGExtractor] Concluído:", _captured.size, "usuários");

    _captured.delete(baseProfile);
    _captured.delete(baseProfile?.toLowerCase());
    RESERVED.forEach(r => _captured.delete(r));
    _captured.delete("");

    return Array.from(_captured).slice(0, targetCount);
  }

  async function scanProfileBio() {
    await waitFor("header", 12000);
    await dismissPopups();
    await sleep(800);

    let text = "";
    ["header","main","article","section"].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) text += " " + (el.innerText || "");
    });
    if (!text.trim()) text = document.body.innerText || "";

    const waNumbers = (text.match(/wa\.me\/(\d{8,15})/g) || []).map(l => l.replace("wa.me/",""));

    const formatted = [];
    const fmtRegex = /(?:\+55[\s.-]?)?\((\d{2})\)[\s.-]?(\d{4,5})[\s.-]?(\d{4})/g;
    let m;
    while ((m = fmtRegex.exec(text)) !== null) {
      const ddd = parseInt(m[1], 10);
      if (ddd >= 11 && ddd <= 99)
        formatted.push((m[1] + m[2] + m[3]).replace(/\D/g, ""));
    }

    const withCountry = [];
    const ccRegex = /\+55[\s.-]?(\d{2})[\s.-]?(\d{4,5})[\s.-]?(\d{4})/g;
    while ((m = ccRegex.exec(text)) !== null)
      withCountry.push(("55" + m[1] + m[2] + m[3]).replace(/\D/g, ""));

    const cleaned = Array.from(new Set(
      [...waNumbers, ...withCountry, ...formatted]
        .map(n => n.replace(/\D/g, ""))
        .filter(n => n.length >= 10 && n.length <= 13)
        .filter(n => !/^(19|20)\d{2}$/.test(n))
    ));

    let displayName = "";
    for (const el of document.querySelectorAll("header h1,header h2,header span[dir='auto'],section h1,section h2")) {
      const t = (el.textContent || "").trim();
      if (t && t.length > 1 && t.length < 80) { displayName = t; break; }
    }
    return { phone: cleaned[0] || "", displayName };
  }

  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type === "COLLECT_USERNAMES" || msg.type === "CAPTURE_FOLLOWERS") {
      collectUsernames(msg.targetCount, msg.profile)
        .then(u => sendResponse({ ok: true, usernames: u, totalSeen: u.length }))
        .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
      return true;
    }
    if (msg.type === "SCAN_PROFILE") {
      scanProfileBio()
        .then(r => sendResponse({ ok: true, phone: r.phone, displayName: r.displayName }))
        .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
      return true;
    }
  });
}
