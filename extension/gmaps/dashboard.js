/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator Google Maps
   Fase 1: rola a lista de resultados e coleta URLs dos places
   Fase 2: abre cada place e extrai telefone, site, categoria
   ══════════════════════════════════════════════════════════ */

let _stopped = false;

function getSearchKey(tenantId, query) {
  return `gmaps:${tenantId}:${query.toLowerCase().trim()}`;
}

/* ── Navegação ── */
function switchSection(id) {
  document.querySelectorAll(".section").forEach(s =>
    s.classList.toggle("active", s.id === id)
  );
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.getAttribute("data-section") === id.replace("section-", ""))
  );
  const titles = { capture: "Extração de Leads", dashboard: "Resultados", config: "Configuração" };
  const key = id.replace("section-", "");
  document.getElementById("topbarTitle").textContent = titles[key] || "LeadFlowAI";
}

/* ── Status / progresso ── */
function setStatus(elId, text, type = "info") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text || "";
  el.className = "status-msg" + (text ? (" show s-" + type) : "");
}

function setProgress(text, pct = null) {
  const block = document.getElementById("progressBlock");
  const label = document.getElementById("captureProgress");
  const bar   = document.getElementById("progressBar");
  if (!text) { block.classList.remove("show"); return; }
  block.classList.add("show");
  label.textContent = text;
  if (pct !== null) bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
}

/* ── Stats cards ── */
function updateStats(searches) {
  const entries = Object.values(searches || {});
  if (!entries.length) {
    ["stat-found","stat-extracted","stat-phones"].forEach(id => {
      document.getElementById(id).textContent = "—";
    });
    return;
  }
  // Mostra stats da busca mais recente
  const latest = entries[entries.length - 1];
  document.getElementById("stat-found").textContent     = latest.places?.length || 0;
  document.getElementById("stat-extracted").textContent = latest.extractIndex   || 0;
  document.getElementById("stat-phones").textContent    = (latest.leads || []).filter(l => l.phone).length;
}

/* ── sendWithRetry ── */
function sendWithRetry(tabId, message, callback, maxTries = 12, baseDelay = 1500) {
  let tries = 0;
  function attempt() {
    tries++;
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        if (tries < maxTries) { setTimeout(attempt, baseDelay + tries * 300); return; }
        // Última tentativa: reinjecta o content-script
        chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] }, () => {
          setTimeout(() => chrome.tabs.sendMessage(tabId, message, r => callback(r || null)), 2500);
        });
        return;
      }
      callback(resp || null);
    });
  }
  setTimeout(attempt, 4000);
}

/* ── waitTabComplete ── */
function waitTabComplete(tabId, callback) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) { setTimeout(() => waitTabComplete(tabId, callback), 500); return; }
    if (tab.status === "complete") { callback(); return; }
    const listener = (id, info) => {
      if (id !== tabId || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      callback();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/* ══════════════════════════════════════════════════════════
   FASE 1 — Scroll e coleta de places
   ══════════════════════════════════════════════════════════ */
function runPhase1(tabId, query, limit, tenantId, key, searches) {
  if (_stopped) return;
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
  setStatus("captureStatus", `⏳ Abrindo Google Maps: ${query}...`, "info");
  setProgress("Carregando Google Maps...", 3);

  chrome.tabs.update(tabId, { url: searchUrl }, () => {
    // Aguarda a aba carregar E mais um tempo para o Google Maps renderizar os resultados
    waitTabComplete(tabId, () => {
      setTimeout(() => {
        setProgress("Rolando resultados e coletando empresas...", 8);
        sendWithRetry(
          tabId,
          { type: "GM_SCROLL_COLLECT", targetCount: limit },
          (response) => {
            if (_stopped) return;
            if (!response || !response.ok) {
              setStatus("captureStatus",
                response?.error || "Não foi possível coletar resultados. Verifique se o Google Maps abriu corretamente.",
                "err"
              );
              setProgress(null);
              enableStartButton();
              chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
              return;
            }

            const places = response.places || [];
            const existing = new Map((searches[key]?.places || []).map(p => [p.url, p]));
            places.forEach(p => existing.set(p.url, p));
            const merged = Array.from(existing.values());

            searches[key] = {
              ...(searches[key] || {}),
              query,
              places: merged,
              extractIndex: searches[key]?.extractIndex || 0,
              leads: searches[key]?.leads || [],
            };

            chrome.storage.local.set({ searches }, () => {
              setProgress(`Fase 1: ${merged.length} empresas encontradas. Extraindo detalhes...`, 15);
              updateStats(searches);
              runPhase2(tabId, tenantId, key, searches, limit);
            });
          },
          14, 2000
        );
      }, 4000); // Aguarda 4s após carregar para o Maps renderizar
    });
  });
}

/* ══════════════════════════════════════════════════════════
   FASE 2 — Extrai detalhes de cada place
   ══════════════════════════════════════════════════════════ */
function runPhase2(tabId, tenantId, key, searches, limit) {
  if (_stopped) { enableStartButton(); return; }

  chrome.storage.local.get(["searches"], (data) => {
    const allSearches = data.searches || searches;
    const s = allSearches[key];

    if (!s || !s.places || s.places.length === 0) {
      setStatus("captureStatus", "Nenhum lugar para extrair detalhes.", "err");
      setProgress(null);
      enableStartButton();
      chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
      return;
    }

    let extractIndex = s.extractIndex || 0;
    const leads = [...(s.leads || [])];
    let extracted = 0;
    const toProcess = Math.min(s.places.length, limit);

    function step() {
      if (_stopped || extractIndex >= s.places.length || extracted >= toProcess) {
        // Extração concluída
        const withPhone = leads.filter(l => l.phone).length;
        const updated = { ...s, extractIndex, leads };
        const newSearches = { ...allSearches, [key]: updated };
        chrome.storage.local.set({ searches: newSearches }, () => {
          setProgress(
            `✅ Concluído: ${s.places.length} encontrados · ${extracted} extraídos · ${withPhone} com telefone`,
            100
          );
          setStatus("captureStatus",
            `Extração finalizada. ${withPhone} leads com telefone prontos para envio.`,
            _stopped ? "info" : "ok"
          );
          updateStats(newSearches);
          renderSearchesTable(newSearches);
          enableStartButton();
          chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
        });
        return;
      }

      const place = s.places[extractIndex];
      if (!place?.url) { extractIndex++; step(); return; }

      // Verifica se já foi extraído
      if (leads.some(l => l.url === place.url)) { extractIndex++; step(); return; }

      const pct = 15 + Math.round((extracted / toProcess) * 83);
      setProgress(
        `Fase 2: extraindo ${extracted + 1}/${toProcess} — ${place.name}`,
        pct
      );

      // Navega para a página do lugar
      chrome.tabs.update(tabId, { url: place.url }, () => {
        waitTabComplete(tabId, () => {
          sendWithRetry(tabId, { type: "GM_EXTRACT_DETAILS" }, (resp) => {
            if (_stopped) {
              // Salva progresso e para
              const updatedStop = { ...s, extractIndex, leads };
              const stopSearches = { ...allSearches, [key]: updatedStop };
              chrome.storage.local.set({ searches: stopSearches });
              enableStartButton();
              return;
            }

            // Adiciona o lead (mesmo sem telefone, para mostrar no CSV)
            const name = resp?.name || place.name;
            const phone = (resp?.phone || "").replace(/\D/g, "");
            leads.push({
              url:      place.url,
              name:     name,
              phone:    phone,
              website:  resp?.website || "",
              category: resp?.category || "",
              address:  resp?.address || "",
            });

            extractIndex++;
            extracted++;

            // Salva a cada 5 extrações
            if (extracted % 5 === 0) {
              const snap = { ...s, extractIndex, leads };
              chrome.storage.local.set({ searches: { ...allSearches, [key]: snap } });
              updateStats({ ...allSearches, [key]: snap });
            }

            // Delay humanizado entre requests (2–5s)
            const delay = 2000 + Math.random() * 3000;
            setTimeout(step, delay);
          });
        });
      });
    }

    step();
  });
}

/* ── Helpers de UI ── */
function enableStartButton() {
  const btn = document.getElementById("startCapture");
  const stop = document.getElementById("stopCapture");
  if (btn) { btn.disabled = false; btn.textContent = "▶ Iniciar extração"; }
  if (stop) stop.style.display = "none";
}

function disableStartButton() {
  const btn = document.getElementById("startCapture");
  const stop = document.getElementById("stopCapture");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Extraindo..."; }
  if (stop) stop.style.display = "inline-flex";
}

/* ── Render tabela de resultados ── */
function renderSearchesTable(searches) {
  const entries = Object.entries(searches || {});
  const body = document.getElementById("searchesBody");
  body.innerHTML = "";

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">Nenhuma extração ainda.</td></tr>';
    document.getElementById("summary").textContent = "Nenhuma extração realizada ainda.";
    return;
  }

  let totalFound = 0, totalPhones = 0;
  entries.forEach(([, s]) => {
    const found  = s.places?.length || 0;
    const phones = (s.leads || []).filter(l => l.phone).length;
    const extr   = s.extractIndex || 0;
    totalFound  += found;
    totalPhones += phones;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.query || "—"}</td>
      <td>${found}</td>
      <td>${phones > 0 ? `<span class="chip chip-green">📱 ${phones}</span>` : `<span class="chip chip-gray">0</span>`}</td>
      <td>${extr}</td>
    `;
    body.appendChild(tr);
  });

  document.getElementById("summary").textContent =
    `${entries.length} busca(s) · ${totalFound} empresas · ${totalPhones} com telefone`;
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  /* Pré-config do config.json (ZIP baixado pelo painel) */
  function loadConfigJson() {
    return fetch(chrome.runtime.getURL("config.json"))
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg || !cfg.tenantId || !cfg.extensionToken || !cfg.webhookUrl) return;
        chrome.storage.local.set({
          tenantId: String(cfg.tenantId),
          extensionToken: String(cfg.extensionToken),
          webhookUrl: String(cfg.webhookUrl),
          preConfigured: true,
        }, () => {
          const el = document.getElementById("tenantId");
          if (el) { el.readOnly = true; el.title = "Pré-configurado pelo painel (somente leitura)."; }
        });
      })
      .catch(() => {});
  }

  /* Auto-config via URL params */
  (function autoConfigFromURL() {
    try {
      const p = new URLSearchParams(window.location.search);
      const tid = p.get("tid") || p.get("tenantId");
      const tok = p.get("tok") || p.get("token");
      const wh  = p.get("wh")  || p.get("webhook");
      if (tid && tok && wh) {
        chrome.storage.local.set({ tenantId: tid, extensionToken: tok, webhookUrl: decodeURIComponent(wh) }, () => {
          history.replaceState({}, "", location.pathname);
        });
      }
    } catch(e) {}
  })();

  /* Navegação */
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.getAttribute("data-section");
      switchSection(`section-${sec}`);
      if (sec === "dashboard") renderSearchesTable({});
    });
  });

  /* Carrega config salva (após config.json ter chance de preencher) */
  loadConfigJson().then(() => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "lastQuery", "searches", "preConfigured"],
      (data) => {
        if (data.tenantId)       document.getElementById("tenantId").value = data.tenantId;
        if (data.extensionToken) document.getElementById("token").value = data.extensionToken;
        if (data.webhookUrl)     document.getElementById("webhookUrl").value = data.webhookUrl;
        if (data.lastQuery)      document.getElementById("query").value = data.lastQuery;
        if (data.preConfigured) {
          const el = document.getElementById("tenantId");
          if (el) { el.readOnly = true; el.title = "Pré-configurado pelo painel (somente leitura)."; }
        }

        updateStats(data.searches || {});
        renderSearchesTable(data.searches || {});
      }
    );
  });

  /* Salvar configuração */
  document.getElementById("saveConfig").addEventListener("click", () => {
    const tenantId       = document.getElementById("tenantId").value.trim();
    const extensionToken = document.getElementById("token").value.trim();
    const webhookUrl     = document.getElementById("webhookUrl").value.trim();

    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus("configStatus", "Preencha Tenant, Token e Webhook.", "err"); return;
    }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl }, () => {
      setStatus("configStatus", "Configuração salva com sucesso.", "ok");
    });
  });

  /* Parar extração */
  document.getElementById("stopCapture").addEventListener("click", () => {
    _stopped = true;
    setStatus("captureStatus", "⏹ Extração interrompida pelo usuário. Os leads extraídos até agora foram salvos.", "info");
    setProgress(null);
  });

  /* Iniciar captura */
  document.getElementById("startCapture").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "searches"],
      (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const query          = document.getElementById("query").value.trim();
        const limit          = parseInt(document.getElementById("limit").value || "50", 10);

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("captureStatus", "Configure Tenant, Token e Webhook (aba Configuração).", "err"); return;
        }
        if (!query) {
          setStatus("captureStatus", "Informe o termo de busca (ex.: advogados em BH).", "err"); return;
        }
        if (!limit || limit <= 0) {
          setStatus("captureStatus", "Informe uma quantidade válida.", "err"); return;
        }

        _stopped = false;
        disableStartButton();
        setStatus("captureStatus", "", "info");

        chrome.storage.local.set({ lastQuery: query });

        const searches = data.searches || {};
        const key = getSearchKey(tenantId, query);

        // Abre uma janela nova e logo minimiza (state: "minimized" não é válido no create)
        chrome.windows.create({
          url: "about:blank",
          focused: false,
          width: 1200,
          height: 800,
        }, (win) => {
          if (win?.id) chrome.windows.update(win.id, { state: "minimized" });
          const tab = win?.tabs?.[0];
          if (!tab?.id) {
            setStatus("captureStatus", "Não foi possível abrir a janela do Google Maps.", "err");
            enableStartButton();
            return;
          }
          runPhase1(tab.id, query, limit, tenantId, key, searches);
        });
      }
    );
  });

  /* Enviar para SaaS */
  document.getElementById("sendToSaaS").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "lastQuery", "searches"],
      async (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const query          = document.getElementById("query").value.trim()    || data.lastQuery?.trim();

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("sendStatus", "Configure Tenant, Token e Webhook.", "err"); return;
        }
        if (!query) {
          setStatus("sendStatus", "Informe o termo de busca da extração.", "err"); return;
        }

        const key = getSearchKey(tenantId, query);
        const s = (data.searches || {})[key];
        if (!s?.leads?.length) {
          setStatus("sendStatus", "Nenhum lead extraído para esta busca. Execute a extração primeiro.", "err"); return;
        }

        const leadsComTelefone = s.leads.filter(l => l.phone && l.phone.trim());
        if (!leadsComTelefone.length) {
          setStatus("sendStatus",
            `Nenhum lead com telefone entre ${s.leads.length} extraídos. Tente aumentar a quantidade.`, "err");
          return;
        }

        const folder = document.getElementById("folder").value.trim() || null;

        setStatus("sendStatus", `Enviando ${leadsComTelefone.length} leads...`, "info");

        const payload = leadsComTelefone.map(l => ({
          company: l.name || "Empresa",
          phone:   l.phone,
          folder_name: folder,
        }));

        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id":       tenantId,
              "x-extension-token": extensionToken,
            },
            body: JSON.stringify({ leads: payload, source: "gmaps", query }),
          });

          if (!res.ok) {
            setStatus("sendStatus", "Erro ao enviar: " + (await res.text() || res.statusText), "err");
            return;
          }

          setStatus("sendStatus",
            `✅ ${leadsComTelefone.length} leads enviados! (${s.leads.length - leadsComTelefone.length} sem telefone ignorados)`,
            "ok");
        } catch {
          setStatus("sendStatus", "Erro de rede. Verifique a URL do Webhook.", "err");
        }
      }
    );
  });

  /* Exportar CSV */
  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.storage.local.get(["tenantId", "lastQuery", "searches"], (data) => {
      const tenantId = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
      const query    = document.getElementById("query").value.trim() || data.lastQuery?.trim();

      if (!tenantId || !query) {
        setStatus("sendStatus", "Informe Tenant e o termo de busca.", "err"); return;
      }

      const key = getSearchKey(tenantId, query);
      const s = (data.searches || {})[key];
      if (!s?.leads?.length) {
        setStatus("sendStatus", "Nenhum lead para exportar.", "err"); return;
      }

      const rows = [
        ["name", "phone", "category", "website", "address"],
        ...s.leads.map(l => [l.name||"", l.phone||"", l.category||"", l.website||"", l.address||""])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
      const filename = `gmaps-${query.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.csv`;
      chrome.downloads.download({ url, filename, saveAs: true }, () => {
        setStatus("sendStatus", `CSV exportado com ${s.leads.length} registros.`, "ok");
      });
    });
  });

  /* Clica em dashboard ao abrir */
  document.querySelector('[data-section="capture"]').click();
});

/* ── Dashboard inicial ── */
function loadDashboard() {
  chrome.storage.local.get(["searches"], (data) => renderSearchesTable(data.searches || {}));
}
