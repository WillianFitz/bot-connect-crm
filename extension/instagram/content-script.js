// Content script que roda dentro do Instagram Web

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureFollowersDialog() {
  // Se já estamos na rota /followers/, não abrimos popup,
  // pois a lista já está em página própria.
  if (location.pathname.endsWith("/followers/")) {
    return null;
  }

  // Tenta encontrar um diálogo aberto de seguidores
  let dialogRoot = document.querySelector("div[role='dialog']");
  if (dialogRoot) return dialogRoot;

  // Se não houver, tenta clicar no link/botão de "Seguidores"/"Followers"
  const candidates = Array.from(
    document.querySelectorAll("a, button, span"),
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

function extractUsernamesFromPage(baseProfile) {
  const set = new Set();

  // Varre a página toda em /followers/ procurando URLs do tipo "/username/"
  const links = document.querySelectorAll("a[href^='/']");

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    // tenta extrair padrão "/username/" (ignorando query/fragmentos)
    const match = href.match(/^\/([^\/?#]+)\/?/);
    if (!match) return;
    const username = match[1].trim();
    if (!username) return;

    const lower = username.toLowerCase();
    // ignora rotas conhecidas que não são usuários
    const blockedPrefixes = [
      "accounts",
      "explore",
      "reels",
      "direct",
      "stories",
      "about",
      "p",
      "reel",
      "tv",
    ];
    if (blockedPrefixes.some((p) => lower.startsWith(p))) return;

    if (baseProfile && lower === baseProfile.toLowerCase()) return;

    set.add(username);
  });

  return Array.from(set);
}

async function scrollFollowersList(targetCount, baseProfile) {
  const dialogRoot = await ensureFollowersDialog();
  const hasDialog = !!dialogRoot;

  const dialogScroll =
    (dialogRoot &&
      (dialogRoot.querySelector("div[role='presentation']") ||
        dialogRoot.querySelector("div[style*='overflow']"))) ||
    null;

  let container;
  if (hasDialog && dialogScroll) {
    container = dialogScroll;
  } else {
    // modo página /followers/
    container = document.scrollingElement || document.body;
  }

  let previousCount = 0;

  for (let i = 0; i < 40; i++) {
    container.scrollBy(0, 800);
    await sleep(1000);

    const usernames = hasDialog
      ? extractUsernamesFromDialog(dialogRoot, baseProfile)
      : extractUsernamesFromPage(baseProfile);

    // Se estiver usando o popup, podemos parar ao atingir o targetCount.
    // No modo página (/followers/), continuamos até não carregar mais nada
    // para garantir que todos os seguidores possíveis foram listados.
    if (hasDialog && usernames.length >= targetCount) {
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

  const dialogRoot = document.querySelector("div[role='dialog']");
  const hasDialog = !!dialogRoot;

  const allUsernames = hasDialog
    ? extractUsernamesFromDialog(dialogRoot, profile)
    : extractUsernamesFromPage(profile);

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


