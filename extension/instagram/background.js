chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator Instagram instalada.");
});

// Abre o dashboard ao clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// ── Mensagens vindas do popup ou do SaaS ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Iniciar extração (vindo do popup ou do SaaS via popup)
  if (message.type === "START_EXTRACTION") {
    const { tenantId, extensionToken, webhookUrl, profile, limit } = message.payload || {};
    if (!tenantId || !extensionToken || !webhookUrl || !profile || !limit) {
      sendResponse({ ok: false, error: "Parâmetros incompletos." });
      return true;
    }
    chrome.storage.local.set(
      { tenantId, extensionToken, webhookUrl, lastProfile: profile },
      () => {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      }
    );
    return true;
  }

  // Auto-configuração: SaaS envia config diretamente para a extensão
  if (message.type === "SET_CONFIG") {
    const { tenantId, extensionToken, webhookUrl } = message.payload || {};
    if (!tenantId || !extensionToken || !webhookUrl) {
      sendResponse({ ok: false, error: "Config incompleta." });
      return true;
    }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // Retorna o ID da extensão (para o SaaS saber qual extensão está instalada)
  if (message.type === "GET_EXTENSION_ID") {
    sendResponse({ ok: true, extensionId: chrome.runtime.id });
    return true;
  }
});

// ── Auto-config via URL ao abrir o dashboard ──────────────────────────────
// O SaaS pode abrir: chrome-extension://<ID>/dashboard.html?tid=X&tok=Y&wh=URL
// O dashboard.js lê esses parâmetros e salva automaticamente.
// Nada extra necessário aqui — o dashboard.js já cuida disso.
