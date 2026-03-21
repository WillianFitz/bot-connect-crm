chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator WhatsApp instalada.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_EXTENSION_ID") {
    sendResponse({ ok: true, extensionId: chrome.runtime.id });
    return true;
  }
});
