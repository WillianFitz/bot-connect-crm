/* ══════════════════════════════════════════════════════════
   Content Script — Extrator WhatsApp
   Clica em cada participante do grupo para extrair
   nome e telefone do perfil individual.
   ══════════════════════════════════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Normalização de telefone ── */
function normalizePhone(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!cleaned) return '';
  let num = cleaned;
  if (num.startsWith('+')) return num;
  if (num.length === 10 || num.length === 11) return '+55' + num;
  if (num.length === 12 || num.length === 13) return '+' + num;
  if (num.length === 8  || num.length === 9)  return '+55' + num;
  return '+' + num;
}

function looksLikePhone(text) {
  if (!text) return false;
  const d = text.replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 15 && /[\d\s\-\+\(\)]{8,}/.test(text.trim());
}

/* ── Localiza o painel de info do grupo ── */
function findGroupInfoPanel() {
  for (const id of ['group-info-drawer','contact-info-panel','contact-info-drawer','app-viewer']) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }
  // Painel rolável no lado direito
  for (const el of document.querySelectorAll('div')) {
    if (el.clientWidth < 200 || el.clientWidth > 620) continue;
    if (el.scrollHeight <= el.clientHeight + 30) continue;
    const s = window.getComputedStyle(el);
    if (s.overflowY !== 'auto' && s.overflowY !== 'scroll') continue;
    const rect = el.getBoundingClientRect();
    if (rect.left < window.innerWidth * 0.4) continue;
    return el;
  }
  return null;
}

/* ── Retorna chave de texto de um item de lista ── */
function getItemKey(el) {
  for (const s of el.querySelectorAll('span[title], span[dir="auto"], span[dir="ltr"]')) {
    const t = (s.getAttribute('title') || s.textContent || '').trim();
    if (t.length >= 2) return t;
  }
  return el.textContent.trim().slice(0, 50);
}

/* ── Encontra itens de participante no painel ── */
function queryParticipantItems(panel) {
  for (const sel of [
    '[data-testid="cell-frame-container"]',
    '[data-testid*="list-item"]',
    '[data-testid*="participant"]',
    '[data-testid*="contact-list-item"]',
    '[role="listitem"]',
  ]) {
    const items = panel.querySelectorAll(sel);
    if (items.length >= 2) return Array.from(items);
  }
  // Fallback geometria
  const all = Array.from(panel.querySelectorAll('div'));
  const candidates = all.filter(el => {
    const h = el.getBoundingClientRect().height;
    return h >= 40 && h <= 90 &&
           el.querySelectorAll('span[dir="auto"], span[dir="ltr"]').length >= 1;
  });
  return candidates.filter(el => !candidates.some(o => o !== el && o.contains(el)));
}

/* ── Fase 1: Rola o painel e coleta todas as chaves de participante ── */
async function collectParticipantKeys(panel) {
  const keys = [];
  const seen = new Set();

  panel.scrollTop = 0;
  await sleep(400);

  let noNewRounds = 0;

  while (noNewRounds < 6) {
    const items = queryParticipantItems(panel);
    let added = 0;
    for (const item of items) {
      const key = getItemKey(item);
      if (key && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
        added++;
      }
    }
    if (!added) noNewRounds++;
    else noNewRounds = 0;

    panel.scrollTop += 700;
    await sleep(400);
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 30) break;
  }

  // Coleta itens que apareceram no final também
  const items = queryParticipantItems(panel);
  for (const item of items) {
    const key = getItemKey(item);
    if (key && !seen.has(key)) { seen.add(key); keys.push(key); }
  }

  return keys;
}

/* ── Encontra item no DOM pela chave de texto ── */
function findItemByKey(panel, key) {
  const items = queryParticipantItems(panel);
  return items.find(el => getItemKey(el) === key) || null;
}

/* ── Extrai nome e telefone do painel de perfil aberto ── */
async function extractFromProfilePanel() {
  await sleep(900);

  let phone = '';
  let name  = '';

  // Telefone — data-testid
  for (const sel of ['[data-testid="contact-phone-number"]','[data-testid*="phone"]']) {
    const el = document.querySelector(sel);
    if (el) { const t = el.textContent.trim(); if (looksLikePhone(t)) { phone = normalizePhone(t); break; } }
  }

  // Telefone — spans com texto de telefone
  if (!phone) {
    for (const span of document.querySelectorAll('span[dir="ltr"], span[dir="auto"]')) {
      const t = span.textContent.trim();
      if (looksLikePhone(t) && t.length <= 22) { phone = normalizePhone(t); break; }
    }
  }

  // Telefone — link tel:
  if (!phone) {
    const tel = document.querySelector('a[href^="tel:"]');
    if (tel) phone = normalizePhone(tel.getAttribute('href').replace('tel:', ''));
  }

  // Nome — header do painel de contato
  for (const sel of [
    '[data-testid="contact-info-header"] span[dir="auto"]',
    '[data-testid="contact-name"]',
    '[data-testid="contact-display-name"]',
    'h1 span', 'h2 span', 'h1', 'h2',
  ]) {
    const el = document.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (t.length >= 2 && !looksLikePhone(t)) { name = t; break; }
    }
  }

  // Nome — fallback: primeiro span com texto relevante
  if (!name) {
    for (const s of document.querySelectorAll('span[title], span[dir="auto"]')) {
      const t = (s.getAttribute('title') || s.textContent || '').trim();
      if (t.length >= 2 && !looksLikePhone(t) && t !== 'Você' && t !== 'You') {
        name = t; break;
      }
    }
  }

  return { name, phone };
}

/* ── Clica no botão Voltar ── */
async function clickBack() {
  for (const sel of [
    '[data-testid="back"]', '[data-testid="btn-back"]',
    'button[aria-label="Back"]', 'button[aria-label="Voltar"]',
    '[data-testid*="back"]',
  ]) {
    const el = document.querySelector(sel);
    if (el) { el.click(); await sleep(600); return; }
  }
  for (const el of document.querySelectorAll('button,[role="button"]')) {
    const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
    if (lbl.includes('back') || lbl.includes('voltar')) { el.click(); await sleep(600); return; }
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', keyCode: 27 }));
  await sleep(600);
}

/* ══════════════════════════════════════════════════════════
   Extração principal
   ══════════════════════════════════════════════════════════ */
async function extractParticipants(targetCount) {
  await sleep(600);

  const panel = findGroupInfoPanel();
  if (!panel) {
    return {
      ok: false,
      error: 'Painel de informações do grupo não encontrado. Clique no nome do grupo para abrir as informações e tente novamente.',
    };
  }

  // Fase 1: coleta todas as chaves de participante rolando o painel
  const keys = await collectParticipantKeys(panel);

  if (!keys.length) {
    return {
      ok: false,
      error: 'Nenhum participante encontrado. Certifique-se de que o painel de informações está aberto com a lista de participantes visível.',
    };
  }

  const leads   = [];
  const seenKey = new Set();

  // Fase 2: clica em cada participante pelo sua chave
  for (const key of keys) {
    if (leads.length >= targetCount) break;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    // Rola o painel para que o item fique visível
    panel.scrollTop = 0;
    await sleep(200);
    let target = null;
    for (let scroll = 0; scroll < 40; scroll++) {
      target = findItemByKey(panel, key);
      if (target) break;
      panel.scrollTop += 500;
      await sleep(300);
    }

    if (!target) continue; // Item não encontrado, pula

    target.scrollIntoView({ block: 'center' });
    await sleep(200);
    target.click();

    const { name, phone } = await extractFromProfilePanel();
    await clickBack();

    // Aguarda o painel de grupo reaparecer
    await sleep(400);

    if (!name && !phone) continue;
    if (name === 'Você' || name === 'You') continue;

    leads.push({ name: name || phone, phone });
  }

  if (!leads.length) {
    return { ok: false, error: 'Nenhum dado extraído. O painel de perfil pode não estar carregando.' };
  }

  return { ok: true, leads, total: leads.length };
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ ok: true }); return false; }
  if (msg.type === 'EXTRACT_PARTICIPANTS') {
    extractParticipants(msg.targetCount || 5000).then(result => sendResponse(result));
    return true;
  }
});
