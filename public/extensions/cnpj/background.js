chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator CNPJ instalada.");
});

// Abre o dashboard ao clicar no ícone da extensão
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_CONFIG") {
    const { tenantId, extensionToken, webhookUrl, casaDadosApiKey } = message.payload || {};
    if (!tenantId || !extensionToken || !webhookUrl) {
      sendResponse({ ok: false, error: "Config incompleta." });
      return true;
    }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl, casaDadosApiKey }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "GET_EXTENSION_ID") {
    sendResponse({ ok: true, extensionId: chrome.runtime.id });
    return true;
  }
});
