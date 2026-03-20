if (typeof window.__gmExtractorLoaded === "undefined") {
  window.__gmExtractorLoaded = true;

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

  // ══════════════════════════════════════════════════════════
  // FASE 1 — Scroll na lista de resultados e coleta de URLs
  // ══════════════════════════════════════════════════════════
  async function scrollAndCollect(targetCount) {
    // Aguarda a lista de resultados aparecer
    const feedEl = await waitFor(() => {
      return document.querySelector('div[role="feed"]')
        || document.querySelector('.m6QErb[aria-label]')
        || null;
    }, 15000);

    if (!feedEl) {
      throw new Error(
        "Lista de resultados não encontrada. " +
        "Certifique-se de estar na página de busca do Google Maps com resultados visíveis."
      );
    }

    // Encontra o elemento scrollável real (pode ser o pai do feed)
    function getScrollTarget() {
      // Tenta o próprio feed
      if (feedEl.scrollHeight > feedEl.clientHeight + 10) return feedEl;
      // Tenta o pai do feed
      let el = feedEl.parentElement;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 10) return el;
        el = el.parentElement;
      }
      return feedEl;
    }

    await sleep(1500);

    const seen = new Map(); // url → { url, name }
    let stale = 0;
    const MAX_STALE = 10;

    while (seen.size < targetCount) {
      // Coleta todos os links de place visíveis na página
      const allLinks = document.querySelectorAll('a[href*="/maps/place/"]');
      let newFound = 0;

      for (const link of allLinks) {
        const href = link.getAttribute("href") || "";
        if (!href.includes("/maps/place/")) continue;

        // Monta URL absoluta
        let url = href.startsWith("http") ? href : `https://www.google.com${href}`;
        // Remove parâmetros de session que mudam a cada requisição, mantém a identidade do lugar
        // A URL já é suficientemente única pelo caminho /maps/place/...
        if (seen.has(url)) continue;

        // Tenta extrair o nome
        let name = link.getAttribute("aria-label") || "";
        if (!name) {
          const nameEl = link.querySelector(
            '.qBF1Pd, .fontHeadlineSmall, [class*="fontHeadline"], .NrDZNb span'
          );
          name = nameEl ? nameEl.textContent.trim() : "";
        }
        if (!name) {
          // Fallback: texto do link
          name = (link.textContent || "").trim().split("\n")[0].slice(0, 80);
        }
        if (!name || name.length < 2) continue;

        seen.set(url, { url, name });
        newFound++;

        if (seen.size >= targetCount) break;
      }

      if (seen.size >= targetCount) break;

      // Faz scroll para carregar mais resultados
      const scrollTarget = getScrollTarget();
      const prevScrollTop = scrollTarget.scrollTop;
      scrollTarget.scrollTop = scrollTarget.scrollHeight;

      // Aguarda carregamento
      await sleep(1400 + Math.random() * 800);

      const scrolled = scrollTarget.scrollTop > prevScrollTop + 10;
      if (!scrolled && newFound === 0) {
        stale++;
        if (stale >= MAX_STALE) {
          console.log("[GMExtractor] Fim da lista — stale:", stale);
          break;
        }
        await sleep(1500 + stale * 400);
      } else {
        if (newFound > 0) stale = 0;
      }

      console.log(`[GMExtractor] Coletados: ${seen.size}/${targetCount} | novos: ${newFound}`);
    }

    return Array.from(seen.values()).slice(0, targetCount);
  }

  // ══════════════════════════════════════════════════════════
  // FASE 2 — Extrai detalhes do lugar atualmente aberto
  // ══════════════════════════════════════════════════════════
  async function extractPlaceDetails() {
    // Aguarda o painel de detalhes carregar (h1 com o nome do lugar)
    const nameEl = await waitFor(() => {
      const h1 = document.querySelector('h1.DUwDvf, h1[data-attrid], h1');
      if (h1 && h1.textContent.trim().length > 1) return h1;
      return null;
    }, 15000);

    // Aguarda mais um pouco para garantir que telefone e outros dados carregaram
    await sleep(1200);

    // Nome
    const name = nameEl ? nameEl.textContent.trim() : "";

    // Telefone — estratégia em cascata
    let phone = "";

    // 1) Link tel: é o mais confiável
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) {
      phone = telLink.getAttribute("href").replace("tel:", "").replace(/[\s\-()]/g, "");
    }

    // 2) Botão com aria-label contendo número
    if (!phone) {
      const phoneBtns = document.querySelectorAll(
        'button[data-item-id*="phone"], button[aria-label*="Telefone"], button[aria-label*="telefone"], button[aria-label*="lig"]'
      );
      for (const btn of phoneBtns) {
        const label = btn.getAttribute("aria-label") || btn.textContent || "";
        const m = label.match(/(\+?[\d][\d\s\-().]{7,18})/);
        if (m) { phone = m[1].replace(/\D/g, ""); break; }
      }
    }

    // 3) Qualquer elemento com padrão de telefone brasileiro próximo ao ícone de telefone
    if (!phone) {
      const allText = document.querySelectorAll('[class*="rogA2c"], [class*="CsEnBe"], span, div');
      for (const el of allText) {
        const t = (el.textContent || "").trim();
        const m = t.match(/^(\(?\d{2}\)?\s?\d{4,5}[\s\-]?\d{4})$/);
        if (m && el.children.length === 0) {
          phone = m[1].replace(/\D/g, "");
          break;
        }
      }
    }

    // Site
    let website = "";
    const webLink = document.querySelector(
      'a[data-item-id="authority"], a[aria-label*="site"], a[aria-label*="Site"], a[aria-label*="website"]'
    );
    if (webLink) website = webLink.href || "";

    // Categoria
    let category = "";
    const catEl = document.querySelector('button.DkEaL, span.mgr77e, [jsaction*="category"] span');
    if (catEl) category = catEl.textContent.trim();

    // Endereço
    let address = "";
    const addrBtn = document.querySelector(
      'button[data-item-id*="address"], button[aria-label*="ndereço"], button[aria-label*="Endereço"]'
    );
    if (addrBtn) {
      address = (addrBtn.getAttribute("aria-label") || "")
        .replace(/^Endereço:?\s*/i, "")
        .trim();
      if (!address) address = addrBtn.textContent.trim();
    }

    return { name, phone, website, category, address };
  }

  // ══════════════════════════════════════════════════════════
  // Listener de mensagens do dashboard
  // ══════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type === "GM_SCROLL_COLLECT") {
      scrollAndCollect(msg.targetCount || 50)
        .then(places => sendResponse({ ok: true, places }))
        .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
      return true;
    }

    if (msg.type === "GM_EXTRACT_DETAILS") {
      extractPlaceDetails()
        .then(details => sendResponse({ ok: true, ...details }))
        .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
      return true;
    }
  });
}
