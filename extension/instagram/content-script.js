// Content script que roda dentro do Instagram Web

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureFollowersDialog() {
  // Tenta encontrar um diálogo aberto de seguidores
  let dialogRoot = document.querySelector("div[role='dialog']");
  if (dialogRoot) return dialogRoot;

  // Se não houver, tenta clicar no link/botão de "Seguidores"/"Followers"
  const candidates = Array.from(
    document.querySelectorAll("a, button, span, div"),
  ).filter((el) => {
    const text = (el.textContent || "").toLowerCase();
    return text.includes("seguidores") || text.includes("followers");
  });

  const trigger = candidates[0];
  if (trigger) {
    trigger.click();
    // espera o diálogo aparecer
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      dialogRoot = document.querySelector("div[role='dialog']");
      if (dialogRoot) break;
    }
  }

  return dialogRoot;
}

function extractUsernamesFromDialog(dialogRoot, baseProfile) {
  const set = new Set();
  if (!dialogRoot) return [];

  // No popup de seguidores, normalmente existe um container rolável com a lista (ul > li)
  const scrollContainer =
    dialogRoot.querySelector("div[role='presentation'] ul") ||
    dialogRoot.querySelector("ul");

  if (!scrollContainer) return [];

  const links = scrollContainer.querySelectorAll("a[href^='/']");

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    // tenta extrair padrão "/username/" (ignorando query/fragmentos)
    const match = href.match(/^\/([^\/?#]+)\/?/);
    if (!match) return;
    const username = match[1].trim();
    if (!username) return;

    // ignora o próprio perfil base
    if (baseProfile && username.toLowerCase() === baseProfile.toLowerCase()) return;

    set.add(username);
  });

  return Array.from(set);
}

async function scrollFollowersList(targetCount, baseProfile) {
  const dialogRoot = await ensureFollowersDialog();
  if (!dialogRoot) {
    throw new Error(
      "Não foi possível abrir a lista de seguidores. Clique em 'Seguidores' e tente novamente.",
    );
  }

  const dialogScroll =
    dialogRoot.querySelector("div[role='presentation'] [style*='overflow']") ||
    dialogRoot.querySelector("div[role='presentation']") ||
    dialogRoot.querySelector("div[style*='overflow']") ||
    dialogRoot;

  const container = dialogScroll;

  let previousCount = 0;

  for (let i = 0; i < 60; i++) {
    container.scrollBy(0, 800);
    await sleep(800);

    const usernames = extractUsernamesFromDialog(dialogRoot, baseProfile);

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

async function captureFollowersRange(startIndex, targetCount, profile) {
  if (!location.hostname.includes("instagram.com")) {
    throw new Error("Abra o Instagram Web para iniciar a captura.");
  }

  const desiredTotal = targetCount;
  await scrollFollowersList(desiredTotal, profile);

  const dialogRoot = await ensureFollowersDialog();
  const allUsernames = extractUsernamesFromDialog(dialogRoot, profile);

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
  let phone = "";
  if (matches.length) {
    const cleaned = matches.map((m) => m.replace(/[^\d]/g, ""));
    const unique = Array.from(new Set(cleaned));
    phone = unique[0] || "";
  }

  // Nome exibido no perfil (display name)
  let displayName = "";
  const nameCandidates = document.querySelectorAll(
    "header h2, header h1, header span[dir='auto']",
  );
  for (const el of nameCandidates) {
    const t = (el.textContent || "").trim();
    if (t && t.length > 1) {
      displayName = t;
      break;
    }
  }

  return { phone, displayName };
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
    scanProfileForPhones(message.username)
      .then((result) => {
        sendResponse({ ok: true, phone: result.phone, displayName: result.displayName });
      })
      .catch((err) => {
        console.error("Erro ao varrer perfil:", err);
        sendResponse({ ok: false, error: String(err?.message || err) });
      });

    return true;
  }
});


