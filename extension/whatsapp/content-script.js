/* ══════════════════════════════════════════════════════════
   Content Script — Extrator WhatsApp
   Extrai participantes do painel de info do grupo aberto
   ══════════════════════════════════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function looksLikePhone(text) {
  if (!text) return false;
  const cleaned = text.replace(/[\s\-\.\(\)]/g, '');
  return /^\+?\d{10,15}$/.test(cleaned);
}

function normalizePhone(text) {
  if (!text) return '';
  const cleaned = text.replace(/[\s\-\.\(\)]/g, '');
  const m = cleaned.match(/(\+?\d{10,15})/);
  if (!m) return '';
  let num = m[1];
  if (!num.startsWith('+')) {
    if (num.length >= 10 && num.length <= 11) num = '+55' + num;
    else if (num.length >= 12) num = '+' + num;
  }
  return num;
}

function extractFromCells(cells) {
  const seen = new Set();
  const leads = [];

  cells.forEach(cell => {
    // Try data-testid selectors first, fall back to span[dir=auto]
    const allSpans = Array.from(cell.querySelectorAll('span[dir="auto"], span[dir="ltr"]'));
    const texts = allSpans.map(s => s.textContent?.trim()).filter(Boolean);

    let phone = '';
    let name = texts[0] || '';

    if (looksLikePhone(texts[0])) {
      phone = normalizePhone(texts[0]);
      name = '';
    } else {
      for (const t of texts.slice(1)) {
        if (looksLikePhone(t)) { phone = normalizePhone(t); break; }
      }
    }

    const key = phone || name;
    if (!key || seen.has(key)) return;
    // Skip "Você" / "You" / empty / very short
    if (name === 'Você' || name === 'You' || name.length < 2) return;
    seen.add(key);
    leads.push({ name, phone });
  });

  return leads;
}

function findScrollableInfoPanel() {
  // WhatsApp Web uses various structures — try several strategies

  // Strategy 1: data-testid selectors
  const testIds = [
    'contact-info-panel',
    'group-info-drawer',
    'contact-info-drawer',
    'group-participants-list',
    'participant-list',
    'participant-list-scroll',
  ];
  for (const id of testIds) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }

  // Strategy 2: find a scrollable element that contains cell-frame-container items
  const allScrollable = document.querySelectorAll('div');
  for (const el of allScrollable) {
    if (el.scrollHeight > el.clientHeight + 50 && el.clientWidth > 150 && el.clientWidth < 500) {
      const cells = el.querySelectorAll('[data-testid="cell-frame-container"]');
      if (cells.length > 0) return el;
    }
  }

  return null;
}

async function extractParticipants(targetCount) {
  // Wait a moment for DOM to stabilize
  await sleep(500);

  const panel = findScrollableInfoPanel();
  const allCells = (panel || document).querySelectorAll('[data-testid="cell-frame-container"]');

  if (allCells.length === 0) {
    return {
      ok: false,
      error: "Painel de participantes não encontrado. No WhatsApp Web, abra um grupo e clique no nome do grupo para abrir as Informações do grupo. Em seguida, clique em Extrair."
    };
  }

  if (!panel) {
    // No scrollable container found, just extract what's visible
    const leads = extractFromCells(allCells);
    return { ok: true, leads, total: leads.length };
  }

  const seen = new Set();
  const leads = [];
  let noNewRounds = 0;
  let prevCount = 0;

  while (leads.length < targetCount && noNewRounds < 10) {
    const cells = panel.querySelectorAll('[data-testid="cell-frame-container"]');
    const newLeads = extractFromCells(cells);

    for (const lead of newLeads) {
      const key = lead.phone || lead.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      leads.push(lead);
    }

    if (leads.length === prevCount) {
      noNewRounds++;
    } else {
      noNewRounds = 0;
      prevCount = leads.length;
    }

    // Scroll to load more
    panel.scrollTop += 600;
    await sleep(600);

    // Stop if reached bottom
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 30) break;
  }

  return { ok: true, leads, total: leads.length };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "EXTRACT_PARTICIPANTS") {
    extractParticipants(msg.targetCount || 5000).then(result => sendResponse(result));
    return true;
  }
});
