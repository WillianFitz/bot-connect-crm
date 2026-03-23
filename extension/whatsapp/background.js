chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão Extrator WhatsApp instalada.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_EXTENSION_ID") {
    sendResponse({ ok: true, extensionId: chrome.runtime.id });
    return true;
  }

  // Proxy de fetch: content scripts têm origem web.whatsapp.com (bloqueada por CORS).
  // O service worker tem origem chrome-extension:// e passa pelo CORS do worker.
  if (message.type === "DO_FETCH") {
    fetch(message.url, {
      method:  message.method  || "POST",
      headers: message.headers || {},
      body:    message.body    ? JSON.stringify(message.body) : undefined,
    })
      .then(async res => {
        const text = await res.text();
        sendResponse({ ok: res.ok, status: res.status, text });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // async
  }
});
