function getProfileKey(tenantId, profile) {
  return `profile:${tenantId}:${profile}`;
}

function switchSection(id) {
  document.querySelectorAll(".section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === id);
  });
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-section") === id.replace("section-", ""),
    );
  });
}

function setStatus(elId, text, ok = true) {
  const el = document.getElementById(elId);
  el.textContent = text || "";
  el.className =
    "status-text " + (text ? (ok ? "status-ok" : "status-err") : "");
}

function setCaptureProgress(text) {
  const el = document.getElementById("captureProgress");
  el.textContent = text || "";
}

document.addEventListener("DOMContentLoaded", () => {
  // Navegação lateral
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");
      switchSection(`section-${target}`);
    });
  });

  // Carrega configs básicas e perfis
  chrome.storage.sync.get(
    ["tenantId", "extensionToken", "webhookUrl", "lastProfile", "profiles"],
    (data) => {
      if (data.tenantId)
        document.getElementById("tenantId").value = data.tenantId;
      if (data.extensionToken)
        document.getElementById("token").value = data.extensionToken;
      if (data.webhookUrl)
        document.getElementById("webhookUrl").value = data.webhookUrl;
      if (data.lastProfile)
        document.getElementById("profile").value = data.lastProfile;

      renderProfilesTable(data.profiles || {});
    },
  );

  // Salvar config
  document.getElementById("saveConfig").addEventListener("click", () => {
    const tenantId = document.getElementById("tenantId").value.trim();
    const extensionToken = document.getElementById("token").value.trim();
    const webhookUrl = document.getElementById("webhookUrl").value.trim();
    const profile = document.getElementById("profile").value.trim();

    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus(
        "configStatus",
        "Preencha Tenant, Token e Webhook antes de salvar.",
        false,
      );
      return;
    }

    chrome.storage.sync.set(
      { tenantId, extensionToken, webhookUrl, lastProfile: profile || "" },
      () => {
        setStatus("configStatus", "Configuração salva com sucesso.", true);
      },
    );
  });

  // Iniciar/Continuar captura (seguidores + varredura de perfis)
  document.getElementById("startCapture").addEventListener("click", () => {
    chrome.storage.sync.get(
      ["tenantId", "extensionToken", "webhookUrl", "profiles"],
      (data) => {
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
          setStatus(
            "captureStatus",
            "Configure Tenant, Token e Webhook antes.",
            false,
          );
          return;
        }
        if (!profile) {
          setStatus(
            "captureStatus",
            "Informe o @perfil (sem @) para capturar.",
            false,
          );
          return;
        }
        if (!limit || limit <= 0) {
          setStatus(
            "captureStatus",
            "Informe uma quantidade válida de seguidores.",
            false,
          );
          return;
        }

        const profiles = data.profiles || {};
        const key = getProfileKey(tenantId, profile);
        const p = profiles[key] || {
          usernames: [],
          lastIndex: 0,
          totalCaptured: 0,
          scanIndex: 0,
          leads: [],
        };

        const startIndex = p.lastIndex || 0;
        const targetCount = startIndex + limit;

        setStatus(
          "captureStatus",
          `Carregando seguidores de @${profile}...`,
          true,
        );

        chrome.tabs.create(
          {
            url: `https://www.instagram.com/${profile}/followers/`,
            active: false,
          },
          (tab) => {
            if (!tab || !tab.id) {
              setStatus(
                "captureStatus",
                "Não foi possível abrir a aba do Instagram.",
                false,
              );
              return;
            }

            setTimeout(() => {
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
                      "captureStatus",
                      "Erro ao comunicar com a aba. Verifique se o Instagram carregou.",
                      false,
                    );
                    return;
                  }
                  if (!response || !response.ok) {
                    setStatus(
                      "captureStatus",
                      response?.error ||
                        "Não foi possível capturar seguidores. Verifique se o perfil existe.",
                      false,
                    );
                    return;
                  }

                  const newUsernames = response.usernames || [];
                  const existing = new Set(p.usernames || []);
                  newUsernames.forEach((u) => {
                    if (u && !existing.has(u)) existing.add(u);
                  });

                  const merged = Array.from(existing);
                  const newLastIndex = Math.min(merged.length, targetCount);

                  profiles[key] = {
                    usernames: merged,
                    lastIndex: newLastIndex,
                    totalCaptured: merged.length,
                    scanIndex: p.scanIndex || 0,
                    leads: p.leads || [],
                  };

                  chrome.storage.sync.set({ profiles }, () => {
                    setCaptureProgress(
                      `Perfil @${profile}: ${merged.length} seguidores encontrados. Iniciando varredura de perfis...`,
                    );
                    renderProfilesTable(profiles);
                    scanProfilesSequential(
                      tab.id,
                      tenantId,
                      profile,
                      key,
                      profiles,
                      limit,
                    );
                  });
                },
              );
            }, 4000);
          },
        );
      },
    );
  });

  // Enviar para o SaaS (usa leads varridos com telefone)
  document.getElementById("sendToSaaS").addEventListener("click", () => {
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
          setStatus(
            "captureStatus",
            "Configure Tenant, Token e Webhook antes.",
            false,
          );
          return;
        }
        if (!profile) {
          setStatus(
            "captureStatus",
            "Informe o @perfil (sem @) para enviar.",
            false,
          );
          return;
        }

        const profiles = data.profiles || {};
        const key = getProfileKey(tenantId, profile);
        const p = profiles[key];

        if (!p || !Array.isArray(p.leads) || p.leads.length === 0) {
          setStatus(
            "captureStatus",
            "Nenhum lead varrido para este perfil ainda.",
            false,
          );
          return;
        }

        const leads = p.leads.map((l) => ({
          company: l.name || l.username,
          phone: l.phone || "",
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
              "captureStatus",
              "Erro ao enviar para o SaaS: " + (text || res.statusText),
              false,
            );
            return;
          }

          setStatus(
            "captureStatus",
            `Enviado para o SaaS: ${leads.length} leads do perfil @${profile}.`,
            true,
          );
        } catch (e) {
          setStatus(
            "captureStatus",
            "Erro de rede ao enviar para o SaaS.",
            false,
          );
        }
      },
    );
  });

  // Exportar CSV
  document.getElementById("exportCsv").addEventListener("click", () => {
    chrome.storage.sync.get(["tenantId", "profiles"], (data) => {
      const tenantId =
        document.getElementById("tenantId").value.trim() ||
        data.tenantId?.trim();
      const profile = document.getElementById("profile").value.trim();

      if (!tenantId || !profile) {
        setStatus(
          "captureStatus",
          "Informe Tenant e @perfil para exportar.",
          false,
        );
        return;
      }

      const profiles = data.profiles || {};
      const key = getProfileKey(tenantId, profile);
      const p = profiles[key];
      if (!p || !Array.isArray(p.leads) || p.leads.length === 0) {
        setStatus(
          "captureStatus",
          "Nenhum lead com varredura de perfil para exportar.",
          false,
        );
        return;
      }

      const rows = [["username", "name", "phone"]];
      p.leads.forEach((lead) => {
        rows.push([lead.username || "", lead.name || "", lead.phone || ""]);
      });

      const csv = rows
        .map((r) =>
          r
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(";"),
        )
        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);

      chrome.downloads.download(
        {
          url,
          filename: `instagram-${profile}.csv`,
          saveAs: true,
        },
        () => {
          setStatus(
            "captureStatus",
            `CSV exportado para o perfil @${profile}.`,
            true,
          );
        },
      );
    });
  });
});

function scanProfilesSequential(
  tabId,
  tenantId,
  profile,
  key,
  profiles,
  limit,
) {
  chrome.storage.sync.get(["profiles"], (data) => {
    const allProfiles = data.profiles || profiles;
      const p = allProfiles[key];
    if (!p || !Array.isArray(p.usernames) || p.usernames.length === 0) {
      setStatus(
        "captureStatus",
        "Nenhum seguidor para varrer perfil por perfil.",
        false,
      );
      chrome.tabs.remove(tabId);
      return;
    }

    let scanIndex = p.scanIndex || 0;
    let leads = p.leads || [];
    let scannedThisRound = 0;
    const maxToScan = limit;

    const step = () => {
      if (scanIndex >= p.usernames.length || scannedThisRound >= maxToScan) {
        const updated = { ...p, scanIndex, leads };
        const newProfiles = { ...allProfiles, [key]: updated };
        chrome.storage.sync.set({ profiles: newProfiles }, () => {
          setCaptureProgress(
            `Perfil @${profile}: ${p.totalCaptured} seguidores e ${leads.length} perfis varridos.`,
          );
          renderProfilesTable(newProfiles);
          chrome.tabs.remove(tabId);
        });
        return;
      }

      const username = p.usernames[scanIndex];
      if (!username) {
        scanIndex++;
        step();
        return;
      }

      setStatus(
        "captureStatus",
        `Varrendo perfil ${scanIndex + 1} de ${
          p.usernames.length
        } (@${username})...`,
        true,
      );

      chrome.tabs.update(
        tabId,
        { url: `https://www.instagram.com/${username}/` },
        () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(
              tabId,
              { type: "SCAN_PROFILE", username },
              (resp) => {
                if (resp && resp.ok) {
                  leads.push({
                    username,
                    name: resp.displayName || "",
                    phone: resp.phone || "",
                  });
                } else {
                  leads.push({
                    username,
                    name: "",
                    phone: "",
                  });
                }
                scanIndex++;
                scannedThisRound++;
                step();
              },
            );
          }, 4000);
        },
      );
    };

    step();
  });
}

function renderProfilesTable(profiles) {
  const entries = Object.entries(profiles);
  const body = document.getElementById("profilesBody");
  body.innerHTML = "";

  if (!entries.length) {
    body.innerHTML =
      '<tr><td colspan="4" class="small">Nenhum dado ainda.</td></tr>';
  } else {
    let total = 0;
    entries.forEach(([key, value]) => {
      const match = key.match(/^profile:(.+?):(.+)$/);
      const tenantId = match ? match[1] : "-";
      const profile = match ? match[2] : key;
      const totalCaptured = value.totalCaptured || 0;
      const lastIndex = value.lastIndex || 0;
      total += totalCaptured;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tenantId}</td>
        <td>${profile}</td>
        <td>${totalCaptured}</td>
        <td>${lastIndex}</td>
      `;
      body.appendChild(tr);
    });

    const summary = document.getElementById("summary");
    summary.textContent = `Total de perfis: ${
      entries.length
    }. Total de seguidores únicos capturados neste navegador: ${total}.`;
  }
}


