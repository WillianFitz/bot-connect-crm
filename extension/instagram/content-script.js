// Content script que roda dentro do Instagram Web

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrollFollowersList(targetCount) {
  // Tenta rolar o diálogo de seguidores (se existir), senão rola a página inteira.
  const dialog = document.querySelector("div[role='dialog'] div[role='presentation']") ||
    document.querySelector("div[role='dialog'] div[style*='overflow']");

  let container = dialog || document.scrollingElement || document.body;
  let previousCount = 0;

  for (let i = 0; i < 40; i++) {
    container.scrollBy(0, 800);
    await sleep(1000);

    const usernames = extractUsernames();
    if (usernames.length >= targetCount) {
      break;
    }
    if (usernames.length === previousCount) {
      // não está carregando mais nada
      break;
    }
    previousCount = usernames.length;
  }
}

function extractUsernames() {
  const set = new Set();

  // Seletores típicos da lista de seguidores
  const items = document.querySelectorAll("div[role='dialog'] li, main li");
  items.forEach((item) => {
    const link = item.querySelector("a:not([href='#'])");
    if (!link) return;
    const username = (link.textContent || "").trim();
    if (!username) return;
    // ignora textos genéricos
    if (username.toLowerCase().includes("seguidores")) return;
    if (username.toLowerCase().includes("seguindo")) return;
    set.add(username);
  });

  return Array.from(set);
}

async function captureFollowersRange(startIndex, targetCount, profile) {
  if (!location.hostname.includes("instagram.com")) {
    throw new Error("Abra o Instagram Web para iniciar a captura.");
  }

  if (!profile) {
    console.warn("Perfil não informado; usando apenas a página atual.");
  }

  const desiredTotal = targetCount;
  await scrollFollowersList(desiredTotal);
  const allUsernames = extractUsernames();

  return {
    usernames: allUsernames,
    totalSeen: allUsernames.length,
  };
}

async function scanProfileForPhones() {
  // Foca em bio / seções principais do perfil
  const containers = [];
  const main = document.querySelector("main");
  if (main) containers.push(main);
  const header = document.querySelector("header");
  if (header) containers.push(header);

  let text = "";
  containers.forEach((c) => {
    text += " " + (c.innerText || "");
  });

  if (!text) {
    text = document.body.innerText || "";
  }

  // Regex simples para telefones brasileiros (pode pegar alguns falsos, mas funciona bem na prática)
  const regex =
    /(55)?\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g;
  const matches = text.match(regex) || [];
  if (!matches.length) {
    return "";
  }

  // Normaliza: remove espaços e caracteres supérfluos
  const cleaned = matches.map((m) =>
    m.replace(/[^\d]/g, ""),
  );
  // Remove duplicados
  const unique = Array.from(new Set(cleaned));
  return unique[0] || "";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_FOLLOWERS") {
    captureFollowersRange(
      message.startIndex,
      message.targetCount,
      message.profile,
    )
      .then((result) => {
        sendResponse({ ok: true, ...result });
      })
      .catch((err) => {
        console.error("Erro na captura:", err);
        sendResponse({ ok: false, error: String(err?.message || err) });
      });

    return true; // keep channel open (async)
  }

  if (message.type === "SCAN_PROFILE") {
    scanProfileForPhones()
      .then((phone) => {
        sendResponse({ ok: true, phone });
      })
      .catch((err) => {
        console.error("Erro ao varrer perfil:", err);
        sendResponse({ ok: false, error: String(err?.message || err) });
      });

    return true;
  }
});


