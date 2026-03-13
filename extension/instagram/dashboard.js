/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator Instagram
   Fase 1: coleta usernames dos seguidores
   Fase 2: varre bio de cada usuário buscando telefone
   Envio: somente leads com telefone são enviados ao SaaS
   ══════════════════════════════════════════════════════════ */

function getProfileKey(tenantId, profile) {
  return `profile:${tenantId}:${profile}`;
}

/* ── Navegação ── */
function switchSection(id) {
  document.querySelectorAll(".section").forEach(s =>
    s.classList.toggle("active", s.id === id)
  );
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.getAttribute("data-section") === id.replace("section-", ""))
  );
}

/* ── Status / progresso ── */
function setStatus(elId, text, type = "info") {
  const el = document.getElementById(elId);
  el.textContent = text || "";
  el.className = "status-msg" + (text ? (" show s-" + type) : "");
}

function setProgress(text, pct = null) {
  const block = document.getElementById("progressBlock");
  const label = document.getElementById("captureProgress");
  const bar   = document.getElementById("progressBar");
  if (!text) { block.style.display = "none"; return; }
  block.style.display = "flex";
  label.textContent = text;
  if (pct !== null) bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
}

/* ── Stats cards ── */
function updateStats(p) {
  const usernames = p?.usernames?.length || 0;
  const scanned   = p?.scanIndex || 0;
  const phones    = (p?.leads || []).filter(l => l.phone).length;
  document.getElementById("stat-usernames").textContent = usernames || "—";
  document.getElementById("stat-scanned").textContent   = scanned   || "—";
  document.getElementById("stat-phones").textContent    = phones    || "—";
}

function clearStats() {
  ["stat-usernames","stat-scanned","stat-phones"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });
}

/* ── sendWithRetry ── */
function sendWithRetry(tabId, message, callback, maxTries = 10, baseDelay = 1500) {
  let tries = 0;
  function attempt() {
    tries++;
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        if (tries < maxTries) { setTimeout(attempt, baseDelay + tries * 400); return; }
        chrome.scripting.executeScript({ target: { tabId }, files: ["content-script.js"] }, () => {
          setTimeout(() => chrome.tabs.sendMessage(tabId, message, r => callback(r || null)), 2000);
        });
        return;
      }
      callback(resp || null);
    });
  }
  setTimeout(attempt, 5000);
}

/* ── waitTabComplete ── */
function waitTabComplete(tabId, callback) {
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
  setStatus("captureStatus", `⏳ Fase 1: coletando usernames de @${profile}...`, "info");
  setProgress("Conectando ao Instagram...", 5);

  waitTabComplete(tabId, () => {
    sendWithRetry(
      tabId,
      { type: "COLLECT_USERNAMES", targetCount: limit, profile },
      (response) => {
        if (!response || !response.ok) {
          setStatus("captureStatus",
            response?.error || "Não foi possível coletar seguidores. Verifique se está logado no Instagram Web.", "err");
          setProgress(null);
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
          setProgress(`Fase 1 concluída: ${merged.length} usernames. Iniciando varredura de bios...`, 20);
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
function runPhase2(tabId, tenantId, profile, key, profiles, limit) {
  chrome.storage.local.get(["profiles"], (data) => {
    const allProfiles = data.profiles || profiles;
    const p = allProfiles[key];

    if (!p || !p.usernames || p.usernames.length === 0) {
      setStatus("captureStatus", "Nenhum seguidor para varrer.", "err");
      setProgress(null);
      chrome.tabs.get(tabId, t => t?.windowId && chrome.windows.remove(t.windowId));
      return;
    }

    let scanIndex = p.scanIndex || 0;
    const leads   = [...(p.leads || [])];
    let scanned   = 0;

    function step() {
      if (scanIndex >= p.usernames.length || scanned >= limit) {
        const updated    = { ...p, scanIndex, leads };
        const newProfiles = { ...allProfiles, [key]: updated };
        chrome.storage.local.set({ profiles: newProfiles }, () => {
          const withPhone = leads.filter(l => l.phone).length;
          setProgress(`✅ Concluído: ${p.usernames.length} usernames · ${scanned} bios varridas · ${withPhone} com telefone`, 100);
          setStatus("captureStatus", `Captura finalizada. ${withPhone} leads com telefone prontos para envio.`, "ok");
          updateStats(updated);
          renderProfilesTable(newProfiles);
          chrome.tabs.get(tabId, t => t?.windowId && chrome.windows.remove(t.windowId));
        });
        return;
      }

      const username = p.usernames[scanIndex];
      if (!username) { scanIndex++; step(); return; }

      const pct = 20 + Math.round((scanned / limit) * 80);
      setProgress(`Fase 2: varrendo bio ${scanned + 1}/${Math.min(limit, p.usernames.length - (p.scanIndex||0))} — @${username}`, pct);
      setStatus("captureStatus", "", "info");

      chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/` }, () => {
        waitTabComplete(tabId, () => {
          sendWithRetry(tabId, { type: "SCAN_PROFILE", username }, (resp) => {
            pushLead(resp, username, leads);
            scanIndex++;
            scanned++;

            if (scanned % 10 === 0) {
              const snap = { ...p, scanIndex, leads };
              chrome.storage.local.set({ profiles: { ...allProfiles, [key]: snap } });
              updateStats(snap);
            }

            step();
          });
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
    name:  resp?.displayName || "",
    phone: resp?.phone || "",
  });
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  /* Navegação */
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.getAttribute("data-section");
      switchSection(`section-${sec}`);
      if (sec === "dashboard") loadDashboard();
    });
  });

  /* Carrega config + atualiza stats do perfil salvo */
  chrome.storage.local.get(
    ["tenantId", "extensionToken", "webhookUrl", "lastProfile", "profiles"],
    (data) => {
      if (data.tenantId)       document.getElementById("tenantId").value = data.tenantId;
      if (data.extensionToken) document.getElementById("token").value = data.extensionToken;
      if (data.webhookUrl)     document.getElementById("webhookUrl").value = data.webhookUrl;
      if (data.lastProfile)    document.getElementById("profile").value = data.lastProfile;
      renderProfilesTable(data.profiles || {});

      // Atualiza stats do último perfil capturado
      if (data.lastProfile && data.tenantId && data.profiles) {
        const key = getProfileKey(data.tenantId, data.lastProfile);
        updateStats(data.profiles[key]);
      }
    }
  );

  /* Atualiza stats ao mudar o campo perfil */
  document.getElementById("profile").addEventListener("change", () => {
    chrome.storage.local.get(["tenantId", "profiles"], (data) => {
      const profile  = document.getElementById("profile").value.trim();
      const tenantId = document.getElementById("tenantId").value.trim() || data.tenantId;
      if (!profile || !tenantId || !data.profiles) { clearStats(); return; }
      const key = getProfileKey(tenantId, profile);
      updateStats(data.profiles[key]);
    });
  });

  /* ── Salvar configuração ── */
  document.getElementById("saveConfig").addEventListener("click", () => {
    const tenantId       = document.getElementById("tenantId").value.trim();
    const extensionToken = document.getElementById("token").value.trim();
    const webhookUrl     = document.getElementById("webhookUrl").value.trim();

    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus("configStatus", "Preencha Tenant, Token e Webhook antes de salvar.", "err");
      return;
    }
    chrome.storage.local.set(
      { tenantId, extensionToken, webhookUrl },
      () => setStatus("configStatus", "Configuração salva com sucesso.", "ok")
    );
  });

  /* ── Iniciar captura ── */
  document.getElementById("startCapture").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "profiles"],
      (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const profile        = document.getElementById("profile").value.trim();
        const limit          = parseInt(document.getElementById("limit").value || "0", 10);

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("captureStatus", "Configure Tenant, Token e Webhook antes (aba Configuração).", "err"); return;
        }
        if (!profile) {
          setStatus("captureStatus", "Informe o @perfil (sem @).", "err"); return;
        }
        if (!limit || limit <= 0) {
          setStatus("captureStatus", "Informe uma quantidade válida de seguidores.", "err"); return;
        }

        const profiles   = data.profiles || {};
        const key        = getProfileKey(tenantId, profile);
        const p          = profiles[key] || { usernames: [], lastIndex: 0, totalCaptured: 0, scanIndex: 0, leads: [] };
        const startIndex = p.lastIndex || 0;

        chrome.storage.local.set({ lastProfile: profile });
        setStatus("captureStatus", `Abrindo perfil @${profile}...`, "info");

        chrome.windows.create({
          url: `https://www.instagram.com/${profile}/`,
          state: "minimized",
          focused: false,
        }, (win) => {
          const tab = win?.tabs?.[0];
          if (!tab?.id) {
            setStatus("captureStatus", "Não foi possível abrir a aba do Instagram.", "err"); return;
          }
          runPhase1(tab.id, profile, startIndex, limit, tenantId, key, profiles, p);
        });
      }
    );
  });

  /* ── Enviar para SaaS — SOMENTE leads com telefone ── */
  document.getElementById("sendToSaaS").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "profiles"],
      async (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const profile        = document.getElementById("profile").value.trim();

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("captureStatus", "Configure Tenant, Token e Webhook antes (aba Configuração).", "err"); return;
        }
        if (!profile) {
          setStatus("captureStatus", "Informe o @perfil.", "err"); return;
        }

        const p = (data.profiles || {})[getProfileKey(tenantId, profile)];
        if (!p?.leads?.length) {
          setStatus("captureStatus", "Nenhum lead varrido para este perfil. Execute a captura primeiro.", "err"); return;
        }

        // FILTRO: somente leads com telefone
        const leadsComTelefone = p.leads.filter(l => l.phone && l.phone.trim());

        if (!leadsComTelefone.length) {
          setStatus("captureStatus",
            `Nenhum lead com telefone encontrado entre ${p.leads.length} varridos. Tente capturar mais seguidores.`, "err");
          return;
        }

        setStatus("captureStatus", `Enviando ${leadsComTelefone.length} leads com telefone...`, "info");

        const payload = leadsComTelefone.map(l => ({
          company: l.name || l.username,
          phone:   l.phone.trim(),
        }));

        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id":       tenantId,
              "x-extension-token": extensionToken,
            },
            body: JSON.stringify({ leads: payload, done: false }),
          });

          if (!res.ok) {
            setStatus("captureStatus", "Erro ao enviar: " + (await res.text() || res.statusText), "err");
            return;
          }

          setStatus("captureStatus",
            `✅ ${leadsComTelefone.length} leads com telefone enviados para o SaaS (${p.leads.length - leadsComTelefone.length} sem telefone ignorados).`,
            "ok");
        } catch {
          setStatus("captureStatus", "Erro de rede ao enviar. Verifique a URL do Webhook.", "err");
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
        setStatus("captureStatus", "Informe Tenant e @perfil.", "err"); return;
      }

      const p = (data.profiles || {})[getProfileKey(tenantId, profile)];
      if (!p?.leads?.length) {
        setStatus("captureStatus", "Nenhum lead para exportar.", "err"); return;
      }

      const rows = [
        ["username", "name", "phone"],
        ...p.leads.map(l => [l.username || "", l.name || "", l.phone || ""])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));

      chrome.downloads.download({ url, filename: `instagram-${profile}.csv`, saveAs: true }, () => {
        setStatus("captureStatus", `CSV exportado para @${profile} (todos os leads, com e sem telefone).`, "ok");
      });
    });
  });
});

/* ── Dashboard ── */
function loadDashboard() {
  chrome.storage.local.get(["profiles"], (data) => renderProfilesTable(data.profiles || {}));
}

function renderProfilesTable(profiles) {
  const entries = Object.entries(profiles || {});
  const body = document.getElementById("profilesBody");
  body.innerHTML = "";

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px">Nenhum dado ainda.</td></tr>';
    document.getElementById("summary").textContent = "Nenhuma captura realizada ainda.";
    return;
  }

  let totalUsernames = 0, totalPhones = 0;

  entries.forEach(([key, p]) => {
    const m       = key.match(/^profile:(.+?):(.+)$/);
    const tenant  = m ? m[1] : "-";
    const profile = m ? m[2] : key;
    const users   = p.usernames?.length || 0;
    const phones  = (p.leads || []).filter(l => l.phone).length;
    const scanned = p.scanIndex || 0;

    totalUsernames += users;
    totalPhones    += phones;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${tenant}</td>
      <td>@${profile}</td>
      <td>${users}</td>
      <td>${phones > 0
        ? `<span class="chip chip-green">📱 ${phones}</span>`
        : `<span class="chip chip-gray">0</span>`}
      </td>
      <td>${scanned}</td>
    `;
    body.appendChild(tr);
  });

  document.getElementById("summary").textContent =
    `${entries.length} perfil(is) · ${totalUsernames} usernames coletados · ${totalPhones} leads com telefone`;
}
