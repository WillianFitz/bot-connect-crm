function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function navigateAndWait(tabId, url) {
  return new Promise((resolve, reject) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId !== tabId) return;
      if (info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.update(tabId, { url }, () => {
      if (chrome.runtime.lastError) {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(chrome.runtime.lastError);
      }
    });
  });
}

async function injectContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content-script.js"],
      },
      () => resolve(),
    );
  });
}

async function runExtraction({ tenantId, extensionToken, webhookUrl, profile, limit }) {
  // Cria/usa uma aba para o fluxo
  const tab = await new Promise((resolve, reject) => {
    chrome.tabs.create(
      {
        url: `https://www.instagram.com/${profile}/followers/`,
        active: false,
      },
      (t) => {
        if (!t || !t.id) reject(new Error("Não foi possível abrir aba do Instagram."));
        else resolve(t);
      },
    );
  });

  const tabId = tab.id;

  try {
    // garante carregamento completo
    await new Promise((resolve) => {
      const listener = (updatedTabId, info) => {
        if (updatedTabId !== tabId) return;
        if (info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    await injectContentScript(tabId);

    // 1) Captura seguidores
    const usernames = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: "CAPTURE_FOLLOWERS",
          startIndex: 0,
          targetCount: limit,
          profile,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!response || !response.ok) {
            reject(new Error(response?.error || "Falha ao capturar seguidores."));
            return;
          }
          resolve(response.usernames || []);
        },
      );
    });

    const toScan = usernames.slice(0, limit);
    const leads = [];

    // 2) Varre perfil por perfil
    for (let i = 0; i < toScan.length; i++) {
      const username = toScan[i];
      if (!username) continue;

      await navigateAndWait(tabId, `https://www.instagram.com/${username}/`);
      await injectContentScript(tabId);

      const result = await new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tabId,
          { type: "SCAN_PROFILE", username },
          (resp) => {
            if (resp && resp.ok) resolve(resp);
            else resolve({ ok: false });
          },
        );
      });

      leads.push({
        username,
        name: result.displayName || "",
        phone: result.phone || "",
      });

      // delay aleatório 2-5s
      const delay = 2000 + Math.floor(Math.random() * 3000);
      await sleep(delay);
    }

    // 3) Envia para o SaaS
    if (leads.length > 0 && webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
          "x-extension-token": extensionToken,
        },
        body: JSON.stringify({
          leads: leads.map((l) => ({
            company: l.name || l.username,
            phone: l.phone || "",
          })),
          done: false,
        }),
      }).catch(() => {});
    }
  } finally {
    if (tabId) {
      chrome.tabs.remove(tabId);
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_EXTRACTION") {
    runExtraction(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Erro na extração:", err);
        sendResponse({ ok: false, error: String(err?.message || err) });
      });

    return true; // async
  }
});
