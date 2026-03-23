/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator WhatsApp
   Envia mensagem para a aba do WhatsApp Web (content-script)
   e coleta os participantes do grupo aberto.
   ══════════════════════════════════════════════════════════ */

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
function setStatus(elId, text, type) {
  const el = document.getElementById(elId);
  el.textContent = text || "";
  el.className = "status-msg" + (text ? (" show s-" + (type || "info")) : "");
}

function setProgress(text, pct) {
  const block = document.getElementById("progressBlock");
  const label = document.getElementById("captureProgress");
  const bar   = document.getElementById("progressBar");
  if (!text) { block.style.display = "none"; return; }
  block.style.display = "flex";
  label.textContent = text;
  if (pct != null) bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
}

/* ── Stats ── */
function updateStats(leads) {
  const total   = (leads || []).length;
  const phones  = (leads || []).filter(l => l.phone).length;
  const noPhone = total - phones;
  document.getElementById("stat-found").textContent   = total   || "—";
  document.getElementById("stat-phones").textContent  = phones  || "—";
  document.getElementById("stat-nophones").textContent = noPhone || "—";
}

/* ── Storage key ── */
function storageKey(tenantId, groupName) {
  return `wgroup:${tenantId}:${groupName}`;
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  /* ── Pré-config via config.json ── */
  function loadConfigJson() {
    return fetch(chrome.runtime.getURL("config.json"))
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (!cfg || !cfg.tenantId || !cfg.extensionToken || !cfg.webhookUrl) return;
        chrome.storage.local.set({
          tenantId: String(cfg.tenantId),
          extensionToken: String(cfg.extensionToken),
          webhookUrl: String(cfg.webhookUrl),
          preConfigured: true,
        });
      })
      .catch(() => {});
  }

  /* ── Navegação ── */
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.getAttribute("data-section");
      switchSection(`section-${sec}`);
      if (sec === "dashboard") loadDashboard();
    });
  });

  /* ── Carrega config ── */
  loadConfigJson().then(() => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "lastFolder", "lastLimit", "lastLeads", "preConfigured"],
      (data) => {
        if (data.tenantId)       document.getElementById("tenantId").value   = data.tenantId;
        if (data.extensionToken) document.getElementById("token").value      = data.extensionToken;
        if (data.webhookUrl)     document.getElementById("webhookUrl").value = data.webhookUrl;
        if (data.lastFolder)     document.getElementById("folder").value     = data.lastFolder;
        if (data.lastLimit)      document.getElementById("limit").value      = data.lastLimit;
        if (data.preConfigured) {
          const el = document.getElementById("tenantId");
          if (el) { el.readOnly = true; el.title = "Pré-configurado pelo painel."; }
        }
        if (data.lastLeads) updateStats(data.lastLeads);
      }
    );
  });

  /* ── Salvar configuração ── */
  document.getElementById("saveConfig").addEventListener("click", () => {
    const tenantId       = document.getElementById("tenantId").value.trim();
    const extensionToken = document.getElementById("token").value.trim();
    const webhookUrl     = document.getElementById("webhookUrl").value.trim();
    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus("configStatus", "Preencha Tenant, Token e Webhook antes de salvar.", "err"); return;
    }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl },
      () => setStatus("configStatus", "Configuração salva com sucesso.", "ok")
    );
  });

  /* ── Iniciar extração ── */
  document.getElementById("startCapture").addEventListener("click", () => {
    chrome.storage.local.get(["tenantId", "extensionToken", "webhookUrl"], (data) => {
      const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
      const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
      const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
      const folder = document.getElementById("folder").value.trim();
      const limit  = parseInt(document.getElementById("limit").value || "200", 10);

      if (!tenantId || !extensionToken || !webhookUrl) {
        setStatus("captureStatus", "Configure Tenant, Token e Webhook antes (aba Configuração).", "err"); return;
      }

      chrome.storage.local.set({ lastFolder: folder, lastLimit: limit });

      // Encontra aba do WhatsApp Web
      chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          setStatus("captureStatus", "WhatsApp Web não está aberto. Abra web.whatsapp.com em uma aba.", "err"); return;
        }

        const tab = tabs[0];
        document.getElementById("startCapture").disabled = true;
        setProgress("Conectando ao WhatsApp Web...", 10);
        setStatus("captureStatus", "", "info");

        // Ping first to make sure content script is loaded
        chrome.tabs.sendMessage(tab.id, { type: "PING" }, (pingResp) => {
          const proceed = () => {
            setProgress("Extraindo participantes do grupo...", 40);
            chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PARTICIPANTS", targetCount: limit }, (resp) => {
              document.getElementById("startCapture").disabled = false;
              if (chrome.runtime.lastError || !resp) {
                setProgress(null);
                setStatus("captureStatus", "Não foi possível comunicar com o WhatsApp Web. Recarregue a página do WhatsApp e tente novamente.", "err");
                return;
              }
              if (!resp.ok) {
                setProgress(null);
                setStatus("captureStatus", resp.error || "Erro ao extrair participantes.", "err");
                return;
              }

              const leads = resp.leads || [];
              const withPhone = leads.filter(l => l.phone).length;

              setProgress(`✅ ${leads.length} participantes extraídos · ${withPhone} com telefone`, 100);
              setStatus("captureStatus", `Extração concluída. ${withPhone} leads com telefone prontos para envio.`, "ok");
              updateStats(leads);

              // Saves with group name from folder (or generic)
              const groupName = folder || `grupo_${Date.now()}`;
              const key = storageKey(tenantId, groupName);
              chrome.storage.local.get(["groups"], (gdata) => {
                const groups = gdata.groups || {};
                groups[key] = { groupName, leads, extractedAt: Date.now() };
                chrome.storage.local.set({ groups, lastLeads: leads });
              });
            });
          };

          if (chrome.runtime.lastError || !pingResp?.ok) {
            // Inject content script manually
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] }, () => {
              setTimeout(proceed, 1000);
            });
          } else {
            proceed();
          }
        });
      });
    });
  });

  /* ── Enviar para SaaS ── */
  document.getElementById("sendToSaaS").addEventListener("click", () => {
    chrome.storage.local.get(
      ["tenantId", "extensionToken", "webhookUrl", "lastLeads"],
      async (data) => {
        const tenantId       = document.getElementById("tenantId").value.trim() || data.tenantId?.trim();
        const extensionToken = document.getElementById("token").value.trim()    || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById("webhookUrl").value.trim() || data.webhookUrl?.trim();
        const folder         = document.getElementById("folder").value.trim();

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus("sendStatus", "Configure Tenant, Token e Webhook antes (aba Configuração).", "err"); return;
        }

        const leads = data.lastLeads || [];
        const comTelefone = leads.filter(l => l.phone && l.phone.trim());

        if (!comTelefone.length) {
          setStatus("sendStatus", "Nenhum lead com telefone. Execute a extração primeiro.", "err"); return;
        }

        setStatus("sendStatus", `Enviando ${comTelefone.length} leads...`, "info");

        const payload = comTelefone.map(l => ({
          company: l.name || l.phone,
          phone: l.phone.trim(),
          folder_name: folder || undefined,
        }));

        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-tenant-id":       tenantId,
              "x-extension-token": extensionToken,
            },
            body: JSON.stringify({ leads: payload, source: "whatsapp", done: true }),
          });

          if (!res.ok) {
            setStatus("sendStatus", "Erro ao enviar: " + (await res.text() || res.statusText), "err"); return;
          }

          setStatus("sendStatus",
            `✅ ${comTelefone.length} leads enviados para o LeadFlowAI (${leads.length - comTelefone.length} sem telefone ignorados).`, "ok");
        } catch {
          setStatus("sendStatus", "Erro de rede. Verifique a URL do Webhook.", "err");
        }
      }
    );
  });

  /* ── Exportar CSV ── */
  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.storage.local.get(["lastLeads"], (data) => {
      const leads = data.lastLeads || [];
      if (!leads.length) { setStatus("sendStatus", "Nenhum lead para exportar.", "err"); return; }

      const folder = document.getElementById("folder").value.trim() || "whatsapp";
      const rows = [
        ["name", "phone"],
        ...leads.map(l => [l.name || "", l.phone || ""])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      chrome.downloads.download({ url, filename: `whatsapp-${folder}.csv`, saveAs: true }, () => {
        setStatus("sendStatus", "CSV exportado.", "ok");
      });
    });
  });
});

/* ── Dashboard ── */
function loadDashboard() {
  chrome.storage.local.get(["groups"], (data) => {
    const groups = data.groups || {};
    const entries = Object.entries(groups);
    const body = document.getElementById("groupsBody");
    body.innerHTML = "";

    if (!entries.length) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:20px">Nenhuma extração ainda.</td></tr>';
      document.getElementById("summary").textContent = "Nenhuma extração realizada ainda.";
      return;
    }

    let totalLeads = 0, totalPhones = 0;
    entries.forEach(([key, g]) => {
      const leads  = g.leads || [];
      const phones = leads.filter(l => l.phone).length;
      totalLeads  += leads.length;
      totalPhones += phones;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${g.groupName || key}</td>
        <td>${leads.length}</td>
        <td>${phones > 0
          ? `<span class="chip chip-green">📱 ${phones}</span>`
          : `<span class="chip chip-gray">0</span>`}
        </td>
      `;
      body.appendChild(tr);
    });

    document.getElementById("summary").textContent =
      `${entries.length} grupo(s) · ${totalLeads} participantes · ${totalPhones} com telefone`;
  });
}
