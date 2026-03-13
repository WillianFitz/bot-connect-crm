function setStatus(text, ok = true) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = "status " + (ok ? "status-ok" : "status-err");
}

// Carrega config salva
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(
    ["tenantId", "extensionToken", "webhookUrl", "lastProfile"],
    (data) => {
      if (data.tenantId)
        document.getElementById("tenantId").value = data.tenantId;
      if (data.extensionToken)
        document.getElementById("token").value = data.extensionToken;
      if (data.webhookUrl)
        document.getElementById("webhookUrl").value = data.webhookUrl;
      if (data.lastProfile)
        document.getElementById("profile").value = data.lastProfile;
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

  chrome.storage.local.set(
    { tenantId, extensionToken, webhookUrl, lastProfile: profile || "" },
    () => {
      setStatus("Configurações salvas.", true);
    },
  );
});

document.getElementById("start").addEventListener("click", () => {
  const tenantId = document.getElementById("tenantId").value.trim();
  const extensionToken = document.getElementById("token").value.trim();
  const webhookUrl = document.getElementById("webhookUrl").value.trim();
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

  chrome.runtime.sendMessage(
    {
      type: "START_EXTRACTION",
      payload: { tenantId, extensionToken, webhookUrl, profile, limit },
    },
    (resp) => {
      if (chrome.runtime.lastError) {
        setStatus(
          "Erro ao iniciar extração. Tente novamente.",
          false,
        );
        return;
      }
      if (!resp || !resp.ok) {
        setStatus(resp?.error || "Falha ao iniciar extração.", false);
        return;
      }

      setStatus(
        `Extração iniciada para @${profile}. Acompanhe e aguarde o envio para o SaaS.`,
        true,
      );
    },
  );
});

