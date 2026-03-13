/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator Instagram
   Fluxo em 2 fases:
   FASE 1 — Abre perfil alvo, scrolla lista de seguidores,
            coleta todos os usernames (COLLECT_USERNAMES).
   FASE 2 — Para cada username, abre instagram.com/<user>/,
            aguarda carregar e chama SCAN_PROFILE para
            capturar nome e telefone da bio.
   ══════════════════════════════════════════════════════════ */

function getProfileKey(tenantId, profile) {
  return `profile:${tenantId}:${profile}`;
}

function switchSection(id) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.toggle("active", sec.id === id)
  );
  document.querySelectorAll(".nav-button").forEach(btn =>
    btn.classList.toggle("active", btn.getAttribute("data-section") === id.replace("section-", ""))
  );
}

function setStatus(elId, text, ok = true) {
  const el = document.getElementById(elId);
  el.textContent = text || "";
  el.className = "status-text " + (text ? (ok ? "status-ok" : "status-err") : "");
}

function setProgress(text) {
  document.getElementById("captureProgress").textContent = text || "";
}

/* ─── sendWithRetry: tenta enviar mensagem até o content-script responder ─── */
function sendWithRetry(tabId, message, callback, maxTries = 10, baseDelay = 1500) {
  let tries = 0;

  function attempt() {
    tries++;
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        if (tries < maxTries) {
          setTimeout(attempt, baseDelay + tries * 400);
        } else {
          // Último recurso: injeta o content-script manualmente
          chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] }, () => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, message, (r) => callback(r || null));
            }, 2000);
          });
        }
        return;
      }
      callback(resp || null);
    });
  }

  // 3s de espera inicial para o SPA do Instagram renderizar
  setTimeout(attempt, 5000);
}

/* ─── Aguarda uma aba ficar "complete" e chama callback ─── */
function waitTabComplete(tabId, callback) {
  // Verifica se já está completa
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.status === "complete") { callback(); return; }
    const listener = (id, info) => {
      if (id !== tabId || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      callback();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/* ══════════════════════════════════════════════════════════
   FASE 1 — Coleta usernames
   ══════════════════════════════════════════════════════════ */

function runPhase1(tabId, profile, startIndex, limit, tenantId, key, profiles, p) {
  setStatus("captureStatus", `Fase 1: coletando usernames de @${profile}...`, true);

  waitTabComplete(tabId, () => {
    sendWithRetry(
      tabId,
      // FIX: passa `limit` (quantidade desta rodada) em vez de startIndex+limit
      // O content-script usa um Set local que começa do zero — targetCount deve ser
      // relativo ao que precisa capturar agora, não ao total acumulado.
      { type: "COLLECT_USERNAMES", targetCount: limit, profile },
      (response) => {
        if (!response || !response.ok) {
          setStatus("captureStatus",
            response?.error || "Não foi possível coletar seguidores. Verifique se está logado no Instagram Web.", false);
          chrome.tabs.get(tabId, t => t?.windowId && chrome.windows.remove(t.windowId));
          return;
        }

        const newUsernames = response.usernames || [];
        const existing = new Set(p.usernames || []);
        newUsernames.forEach(u => { if (u) existing.add(u); });
        const merged = Array.from(existing);

        profiles[key] = {
          usernames: merged,
          lastIndex: merged.length,
          totalCaptured: merged.length,
          scanIndex: p.scanIndex || 0,
          leads: p.leads || [],
        };

        chrome.storage.local.set({ profiles }, () => {
          setProgress(`Fase 1 concluída: ${merged.length} usernames coletados. Iniciando varredura de bios...`);
          renderProfilesTable(profiles);
          runPhase2(tabId, tenantId, profile, key, profiles, limit, startIndex);
        });
      }
    );
  });
}

/* ══════════════════════════════════════════════════════════
   FASE 2 — Varre bios sequencialmente
   ══════════════════════════════════════════════════════════ */

function runPhase2(tabId, tenantId, profile, key, profiles, limit, startIndex) {
  chrome.storage.local.get(["profiles"], (data) => {
    const allProfiles = data.profiles || profiles;
    const p = allProfiles[key];

    if (!p || !p.usernames || p.usernames.length === 0) {
      setStatus("captureStatus", "Nenhum seguidor para varrer.", false);
      chrome.tabs.get(tabId, t => t?.windowId && chrome.windows.remove(t.windowId));
      return;
    }

    // FIX: começa do scanIndex acumulado (continua de onde parou) e respeita o
    // limite desta rodada com base no startIndex anterior
    let scanIndex = p.scanIndex || 0;
    const leads = [...(p.leads || [])];
    let scanned = 0;
    // Quantos já foram varridos antes desta rodada
    const alreadyScanned = scanIndex;

    function step() {
      if (scanIndex >= p.usernames.length || scanned >= limit) {
        // Salva e encerra
        const updated = { ...p, scanIndex, leads };
        const newProfiles = { ...allProfiles, [key]: updated };
        chrome.storage.local.set({ profiles: newProfiles }, () => {
          const withPhone = leads.filter(l => l.phone).length;
          setProgress(`Concluído: ${p.usernames.length} usernames · ${leads.length} bios varridas · ${withPhone} com telefone.`);
          setStatus("captureStatus", "", true);
          renderProfilesTable(newProfiles);
          chrome.tabs.get(tabId, t => t?.windowId && chrome.windows.remove(t.windowId));
        });
        return;
      }

      const username = p.usernames[scanIndex];
      if (!username) { scanIndex++; step(); return; }

      setStatus("captureStatus",
        `Fase 2: varrendo ${scanIndex + 1}/${p.usernames.length} — @${username}`, true);

      // Navega diretamente para o perfil do seguidor
      chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/` }, () => {
        waitTabComplete(tabId, () => {
          sendWithRetry(
            tabId,
            { type: "SCAN_PROFILE", username },
            (resp) => {
              pushLead(resp, username, leads);
              scanIndex++;
              scanned++;

              // Salva progresso a cada 10 perfis
              if (scanned % 10 === 0) {
                const snap = { ...p, scanIndex, leads };
                const snap2 = { ...allProfiles, [key]: snap };
                chrome.storage.local.set({ profiles: snap2 });
                setProgress(`Fase 2: ${scanned}/${limit} varridos nesta rodada — ${leads.filter(l=>l.phone).length} com telefone`);
              }

              step();
            }
          );
        });
      });
    }

    step();
  });
}

function pushLead(resp, username, leads) {
  if (leads.some(l => l.username === username)) return;
  leads.push({
    username,
    name: resp?.displayName || "",
    phone: resp?.phone || "",
  });
}

/* ══════════════════════════════════════════════════════════
   INIT — event listeners do dashboard
   ══════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {

  // Navegação lateral
  document.querySelectorAll(".nav-button").forEach(btn => {
    btn.addEventListener("click", () => {
      switchSection(`section-${btn.getAttribute("data-section")}`);
      if (btn.getAttribute("data-section") === "dashboard") loadDashboard();
    });
  });

  // Carrega configs salvas
  chrome.storage.local.get(
    ["tenantId", "extensionToken", "webhookUrl", "lastProfile", "profiles"],
    (data) => {
      if (data.tenantId)        document.getElementById("tenantId").value = data.tenantId;
      if (data.extensionToken)  document.getElementById("token").value = data.extensionToken;
      if (data.webhookUrl)      document.getElementById("webhookUrl").value = data.webhookUrl;
      if (data.lastProfile)     document.getElementById("profile").value = data.lastProfile;
      renderProfilesTable(data.profiles || {});
    }
  );

  /* ── Salvar configuração ── */
  document.getElementById("saveConfig").addEventListener("click", () => {
    const tenantId      = document.getElementById("tenantId").value.trim();
    const extensionToken = document.getElementById("token").value.trim();
    const webhookUrl    = document.getElementById("webhookUrl").value.trim();
    const profile       = document.getElementById("profile").value.trim();

    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus("configStatus", "Preencha Tenant, Token e Webhook antes de salvar.", false);
      return;
    }
    chrome.storage.local.set(
      { tenantId, extensionToken, webhookUrl, lastProfile: profile || "" },
      () => setStatus("configStatus", "Configuração salva com sucesso.", true)
    );
  });

  /* ── Iniciar captura ── */
  document.getElementById("startCapture").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "profiles"],
      (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim() || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const profile        = document.getElementById("profile").value.trim();
        const limit          = parseInt(document.getElementById("limit").value || "0", 10);

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("captureStatus", "Configure Tenant, Token e Webhook antes.", false); return;
        }
        if (!profile) {
          setStatus("captureStatus", "Informe o @perfil (sem @).", false); return;
        }
        if (!limit || limit <= 0) {
          setStatus("captureStatus", "Informe uma quantidade válida.", false); return;
        }

        const profiles = data.profiles || {};
        const key = getProfileKey(tenantId, profile);
        const p = profiles[key] || { usernames: [], lastIndex: 0, totalCaptured: 0, scanIndex: 0, leads: [] };
        const startIndex = p.lastIndex || 0;

        chrome.storage.local.set({ lastProfile: profile });
        setStatus("captureStatus", `Abrindo perfil @${profile}...`, true);

        // Abre em janela minimizada
        chrome.windows.create({
          url: `https://www.instagram.com/${profile}/`,
          state: "minimized",
          focused: false,
        }, (win) => {
          const tab = win?.tabs?.[0];
          if (!tab?.id) {
            setStatus("captureStatus", "Não foi possível abrir a aba do Instagram.", false); return;
          }
          // FIX: passa `limit` separado do `startIndex` — content-script recebe
          // apenas o que precisa capturar nesta rodada (relativo, não absoluto)
          runPhase1(tab.id, profile, startIndex, limit, tenantId, key, profiles, p);
        });
      }
    );
  });

  /* ── Enviar para SaaS ── */
  document.getElementById("sendToSaaS").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "profiles"],
      async (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim() || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const profile        = document.getElementById("profile").value.trim();

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("captureStatus", "Configure Tenant, Token e Webhook antes.", false); return;
        }
        if (!profile) {
          setStatus("captureStatus", "Informe o @perfil.", false); return;
        }

        const p = (data.profiles || {})[getProfileKey(tenantId, profile)];
        if (!p?.leads?.length) {
          setStatus("captureStatus", "Nenhum lead varrido para este perfil.", false); return;
        }

        const leads = p.leads.map(l => ({ company: l.name || l.username, phone: l.phone || "" }));
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id": tenantId,
              "x-extension-token": extensionToken,
            },
            body: JSON.stringify({ leads, done: false }),
          });
          if (!res.ok) {
            setStatus("captureStatus", "Erro ao enviar: " + (await res.text() || res.statusText), false); return;
          }
          setStatus("captureStatus", `${leads.length} leads de @${profile} enviados para o SaaS.`, true);
        } catch {
          setStatus("captureStatus", "Erro de rede ao enviar.", false);
        }
      }
    );
  });

  /* ── Exportar CSV ── */
  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.storage.local.get(["tenantId", "profiles"], (data) => {
      const tenantId = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
      const profile  = document.getElementById("profile").value.trim();

      if (!tenantId || !profile) {
        setStatus("captureStatus", "Informe Tenant e @perfil.", false); return;
      }

      const p = (data.profiles || {})[getProfileKey(tenantId, profile)];
      if (!p?.leads?.length) {
        setStatus("captureStatus", "Nenhum lead para exportar.", false); return;
      }

      const rows = [["username", "name", "phone"], ...p.leads.map(l => [l.username||"", l.name||"", l.phone||""])];
      const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
      const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));

      chrome.downloads.download({ url, filename: `instagram-${profile}.csv`, saveAs: true }, () => {
        setStatus("captureStatus", `CSV exportado para @${profile}.`, true);
      });
    });
  });
});

/* ─── Dashboard ─── */

function loadDashboard() {
  chrome.storage.local.get(["profiles"], (data) => {
    renderProfilesTable(data.profiles || {});
  });
}

function renderProfilesTable(profiles) {
  const entries = Object.entries(profiles || {});
  const body = document.getElementById("profilesBody");
  body.innerHTML = "";

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="4" class="small">Nenhum dado ainda.</td></tr>';
    return;
  }

  let total = 0;
  entries.forEach(([key, value]) => {
    const m = key.match(/^profile:(.+?):(.+)$/);
    const tenantId = m ? m[1] : "-";
    const profile  = m ? m[2] : key;
    const cap = value.totalCaptured || 0;
    const last = value.lastIndex || 0;
    total += cap;

    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${tenantId}</td><td>${profile}</td><td>${cap}</td><td>${last}</td>`;
    body.appendChild(tr);
  });

  document.getElementById("summary").textContent =
    `${entries.length} perfil(is) · ${total} seguidores únicos capturados neste navegador.`;
}
