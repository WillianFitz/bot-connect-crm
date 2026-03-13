chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator Instagram instalada.");
});

// Abre o dashboard ao clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Trata mensagens vindas do popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_EXTRACTION") {
    const { tenantId, extensionToken, webhookUrl, profile, limit } =
      message.payload || {};

    if (!tenantId || !extensionToken || !webhookUrl || !profile || !limit) {
      sendResponse({ ok: false, error: "Parâmetros incompletos." });
      return true;
    }

    // Salva config recebida e abre o dashboard para conduzir a captura
    chrome.storage.local.set(
      { tenantId, extensionToken, webhookUrl, lastProfile: profile },
      () => {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      }
    );

    return true; // async
  }
});
