function setStatus(text, ok = true) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status " + (ok ? "status-ok" : "status-err");
}

function setProgress(text) {
  const el = document.getElementById("progress");
  el.textContent = text || "";
}

function getProfileKey(tenantId, profile) {
  return `profile:${tenantId}:${profile}`;
}

// Carrega config salva
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    ["tenantId", "extensionToken", "webhookUrl", "lastProfile", "profiles"],
    (data) => {
      if (data.tenantId) document.getElementById("tenantId").value = data.tenantId;
      if (data.extensionToken)
        document.getElementById("token").value = data.extensionToken;
      if (data.webhookUrl)
        document.getElementById("webhookUrl").value = data.webhookUrl;
      if (data.lastProfile)
        document.getElementById("profile").value = data.lastProfile;

      const tenantId = data.tenantId;
      const profile = data.lastProfile;
      if (tenantId && profile && data.profiles) {
        const key = getProfileKey(tenantId, profile);
        const p = data.profiles[key];
        if (p) {
          setProgress(
            `Perfil ${profile}: ${p.totalCaptured || 0} seguidores já capturados.`,
          );
        }
      }
    },
  );
});

document.getElementById("save").addEventListener("click", () => {
  const tenantId = document.getElementById("tenantId").value.trim();
  const extensionToken = document.getElementById("token").value.trim();
  const webhookUrl = document.getElementById("webhookUrl").value.trim();
  const profile = document.getElementById("profile").value.trim();

  if (!tenantId || !extensionToken || !webhookUrl) {
    setStatus("Preencha Tenant, Token e Webhook.", false);
    return;
  }

  chrome.storage.sync.set(
    { tenantId, extensionToken, webhookUrl, lastProfile: profile || "" },
    () => {
      setStatus("Configurações salvas.", true);
    },
  );
});

document.getElementById("start").addEventListener("click", () => {
  chrome.storage.sync.get(
    ["tenantId", "extensionToken", "webhookUrl", "profiles"],
    (data) => {
      // Sempre prioriza o que está nos campos da tela
      const tenantId =
        document.getElementById("tenantId").value.trim() ||
        data.tenantId?.trim();
      const extensionToken =
        document.getElementById("token").value.trim() ||
        data.extensionToken?.trim();
      const webhookUrl =
        document.getElementById("webhookUrl").value.trim() ||
        data.webhookUrl?.trim();
      const profile = document.getElementById("profile").value.trim();
      const limit = parseInt(
        document.getElementById("limit").value.trim() || "0",
        10,
      );

      if (!tenantId || !extensionToken || !webhookUrl) {
        setStatus("Configure Tenant, Token e Webhook antes.", false);
        return;
      }
      if (!profile) {
        setStatus("Informe o @perfil (sem @).", false);
        return;
      }
      if (!limit || limit <= 0) {
        setStatus("Informe uma quantidade válida de seguidores.", false);
        return;
      }

      const profiles = data.profiles || {};
      const key = getProfileKey(tenantId, profile);
      const p = profiles[key] || {
        usernames: [],
        lastIndex: 0,
        totalCaptured: 0,
      };

      const startIndex = p.lastIndex || 0;
      const targetCount = startIndex + limit;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) {
          setStatus("Nenhuma aba ativa encontrada.", false);
          return;
        }

        chrome.tabs.sendMessage(
          tab.id,
          {
            type: "CAPTURE_FOLLOWERS",
            startIndex,
            targetCount,
            profile,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              setStatus(
                "Erro ao comunicar com a aba. Abra o Instagram Web.",
                false,
              );
              return;
            }
            if (!response || !response.ok) {
              setStatus(
                response?.error || "Não foi possível capturar seguidores.",
                false,
              );
              return;
            }

            const newUsernames = response.usernames || [];
            // mescla sem duplicar
            const existing = new Set(p.usernames || []);
            newUsernames.forEach((u) => {
              if (u && !existing.has(u)) {
                existing.add(u);
              }
            });

            const merged = Array.from(existing);
            const newLastIndex = Math.min(merged.length, targetCount);

            const updated = {
              usernames: merged,
              lastIndex: newLastIndex,
              totalCaptured: merged.length,
            };
            profiles[key] = updated;

            chrome.storage.sync.set({ profiles }, () => {
              setStatus(
                `Captura concluída. Perfil ${profile}: agora ${
                  updated.totalCaptured
                } seguidores guardados.`,
                true,
              );
              setProgress(
                `Perfil ${profile}: ${updated.totalCaptured} seguidores já capturados.`,
              );
            });
          },
        );
      });
    },
  );
});

document.getElementById("send").addEventListener("click", () => {
  chrome.storage.sync.get(
    ["tenantId", "extensionToken", "webhookUrl", "profiles"],
    async (data) => {
      const tenantId =
        document.getElementById("tenantId").value.trim() ||
        data.tenantId?.trim();
      const extensionToken =
        document.getElementById("token").value.trim() ||
        data.extensionToken?.trim();
      const webhookUrl =
        document.getElementById("webhookUrl").value.trim() ||
        data.webhookUrl?.trim();
      const profile = document.getElementById("profile").value.trim();

      if (!tenantId || !extensionToken || !webhookUrl) {
        setStatus("Configure Tenant, Token e Webhook antes.", false);
        return;
      }
      if (!profile) {
        setStatus("Informe o @perfil (sem @).", false);
        return;
      }

      const profiles = data.profiles || {};
      const key = getProfileKey(tenantId, profile);
      const p = profiles[key];

      if (!p || !Array.isArray(p.usernames) || p.usernames.length === 0) {
        setStatus("Nenhum seguidor capturado para este perfil ainda.", false);
        return;
      }

      const leads = p.usernames.map((u) => ({
        company: u,
        phone: "",
      }));

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
            "x-extension-token": extensionToken,
          },
          body: JSON.stringify({
            leads,
            done: false,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          setStatus(
            "Erro ao enviar para o SaaS: " + (text || res.statusText),
            false,
          );
          return;
        }

        setStatus(
          `Enviado para o SaaS: ${leads.length} leads do perfil ${profile}.`,
          true,
        );
      } catch (e) {
        setStatus("Erro de rede ao enviar para o SaaS.", false);
      }
    },
  );
});

// Abre dashboard em nova aba
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});


