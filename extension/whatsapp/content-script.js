/* ══════════════════════════════════════════════════════════
   Content Script — Extrator WhatsApp
   Clica em cada participante do grupo para extrair
   nome e telefone do perfil individual.
   ══════════════════════════════════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function simulateClick(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
}

/* ── Normalização de telefone ── */
function normalizePhone(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10 || cleaned.length === 11) return '+55' + cleaned;
  if (cleaned.length === 12 || cleaned.length === 13) return '+' + cleaned;
  if (cleaned.length === 8  || cleaned.length === 9)  return '+55' + cleaned;
  return '+' + cleaned;
}

function looksLikePhone(text) {
  if (!text) return false;
  const d = text.replace(/[^\d]/g, '');
  return d.length >= 8 && d.length <= 15 && /[\d\s\-\+\(\)]{8,}/.test(text.trim());
}

/* ── Chave de texto de um item de lista ── */
function getItemKey(el) {
  for (const s of el.querySelectorAll('span[title], span[dir="auto"], span[dir="ltr"]')) {
    const t = (s.getAttribute('title') || s.textContent || '').trim();
    if (t.length >= 2) return t;
  }
  return el.textContent.trim().slice(0, 50);
}

/* ── Localiza o painel de info do grupo (rolável, lado direito) ── */
function findGroupInfoPanel() {
  for (const id of ['group-info-drawer','contact-info-panel','contact-info-drawer','app-viewer']) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }
  // Painel rolável no lado direito da tela
  const divs = Array.from(document.querySelectorAll('div'));
  for (const el of divs) {
    if (el.clientWidth < 200 || el.clientWidth > 650) continue;
    if (el.scrollHeight <= el.clientHeight + 30) continue;
    const s    = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && rect.left > window.innerWidth * 0.35) {
      return el;
    }
  }
  return null;
}

/* ── Retorna itens de participante visíveis no painel ── */
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
    return h >= 40 && h <= 90 && el.querySelectorAll('span[dir="auto"], span[dir="ltr"]').length >= 1;
  });
  return candidates.filter(el => !candidates.some(o => o !== el && o.contains(el)));
}

/* ── Aguarda o painel de perfil do contato abrir ── */
async function waitForProfilePanel(timeout = 3500) {
  // NÃO checa botão Voltar — ele existe no próprio painel de info do grupo
  // Checa apenas se um telefone apareceu no DOM (só existe em perfil individual)
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (document.querySelector('[data-testid="contact-phone-number"]')) return true;
    for (const s of document.querySelectorAll('span[dir="ltr"]')) {
      const t = s.textContent.trim();
      if (looksLikePhone(t) && t.length <= 22) return true;
    }
    await sleep(300);
  }
  return false;
}

/* ── Extrai nome e telefone do painel de perfil aberto ── */
async function extractFromProfilePanel() {
  let phone = '';
  let name  = '';

  // Telefone — data-testid
  for (const sel of ['[data-testid="contact-phone-number"]','[data-testid*="phone"]']) {
    const el = document.querySelector(sel);
    if (el) { const t = el.textContent.trim(); if (looksLikePhone(t)) { phone = normalizePhone(t); break; } }
  }
  // Telefone — spans ltr (formato de número)
  if (!phone) {
    for (const s of document.querySelectorAll('span[dir="ltr"]')) {
      const t = s.textContent.trim();
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
    'h1 span[dir="auto"]', 'h2 span[dir="auto"]', 'h1', 'h2',
  ]) {
    const el = document.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (t.length >= 2 && !looksLikePhone(t)) { name = t; break; }
    }
  }
  // Nome — fallback span[title]
  if (!name) {
    for (const s of document.querySelectorAll('span[title], span[dir="auto"]')) {
      const t = (s.getAttribute('title') || s.textContent || '').trim();
      if (t.length >= 2 && !looksLikePhone(t) && t !== 'Você' && t !== 'You') { name = t; break; }
    }
  }

  return { name, phone };
}

/* ── Clica no botão Voltar ── */
async function clickBack() {
  for (const sel of [
    '[data-testid="back"]','[data-testid="btn-back"]',
    'button[aria-label="Back"]','button[aria-label="Voltar"]',
    '[data-testid*="back"]',
  ]) {
    const el = document.querySelector(sel);
    if (el) { el.click(); await sleep(700); return; }
  }
  for (const el of document.querySelectorAll('button,[role="button"]')) {
    const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
    if (lbl.includes('back') || lbl.includes('voltar')) { el.click(); await sleep(700); return; }
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', keyCode: 27 }));
  await sleep(700);
}

/* ══════════════════════════════════════════════════════════
   Extração principal — processa itens visíveis progressivamente
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

  const processed  = new Set();
  const leads      = [];
  let   noProgress = 0;

  while (leads.length < targetCount && noProgress < 10) {
    const items = queryParticipantItems(panel);

    // Encontra o primeiro item não processado
    let target    = null;
    let targetKey = '';
    for (const item of items) {
      const key = getItemKey(item);
      if (!processed.has(key)) { target = item; targetKey = key; break; }
    }

    if (!target) {
      // Sem item novo visível — rola para baixo
      const before = panel.scrollTop;
      panel.scrollTop += 600;
      await sleep(500);
      if (panel.scrollTop === before) break; // Chegou ao fim
      noProgress++;
      continue;
    }

    noProgress = 0;
    processed.add(targetKey);

    // Clica no participante
    target.scrollIntoView({ block: 'center' });
    await sleep(250);
    simulateClick(target);

    // Aguarda o painel de perfil abrir
    const opened = await waitForProfilePanel(3500);

    if (opened) {
      await sleep(300); // Deixa o painel estabilizar
      const { name, phone } = await extractFromProfilePanel();
      await clickBack();
      await sleep(500); // Aguarda painel do grupo reaparecer

      if ((name || phone) && name !== 'Você' && name !== 'You') {
        leads.push({ name: name || phone, phone });
      }
    } else {
      // Perfil não abriu — segue para o próximo sem fechar nada
      await sleep(300);
    }
  }

  if (!leads.length) {
    return { ok: false, error: 'Nenhum dado extraído. Verifique se o painel de informações do grupo está aberto com a lista de participantes visível.' };
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
