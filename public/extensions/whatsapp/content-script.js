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

/* ══════════════════════════════════════════════════════════
   Tenta clicar em "Ver mais participantes"
   ══════════════════════════════════════════════════════════ */
async function tryExpandParticipants() {
  // data-testid específico
  const testBtn = document.querySelector('[data-testid="see-all-participants"]');
  if (testBtn) { simulateClick(testBtn); await sleep(1200); return true; }

  // Busca por texto em qualquer elemento clicável
  const terms = ['ver mais', 'ver todos', 'show more', 'see all', 'see more', 'view all'];
  const allClickable = document.querySelectorAll('[role="button"], button, span, div');
  for (const el of allClickable) {
    if (!el.offsetParent) continue; // Ignora elementos ocultos
    const txt = (el.textContent || '').trim().toLowerCase();
    if (terms.some(t => txt === t || txt.startsWith(t + ' ') || txt.includes('participantes'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 30 && rect.height > 10 && rect.left > window.innerWidth * 0.3) {
        simulateClick(el);
        await sleep(1200);
        return true;
      }
    }
  }
  return false;
}

/* ══════════════════════════════════════════════════════════
   Encontra items de participante na metade direita da tela
   ══════════════════════════════════════════════════════════ */
function findParticipantItems() {
  const rightX = window.innerWidth * 0.3; // Metade direita

  // Tenta seletores conhecidos primeiro, filtrado pelo lado direito
  for (const sel of [
    '[data-testid="cell-frame-container"]',
    '[data-testid*="list-item"]',
    '[data-testid*="participant"]',
    '[data-testid*="contact-list-item"]',
    '[role="listitem"]',
  ]) {
    const items = Array.from(document.querySelectorAll(sel)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.left >= rightX && r.height >= 40 && r.height <= 95 && r.width > 100;
    });
    if (items.length >= 2) return items;
  }

  // Fallback geométrico: divs na direita com altura de item de lista
  const candidates = Array.from(document.querySelectorAll('div')).filter(el => {
    const r = el.getBoundingClientRect();
    if (r.left < rightX || r.height < 40 || r.height > 95 || r.width < 100) return false;
    return el.querySelectorAll('span[dir="auto"], span[dir="ltr"], span[title]').length >= 1;
  });
  // Remove pai/filho duplicados
  return candidates.filter(el => !candidates.some(o => o !== el && o.contains(el)));
}

/* ══════════════════════════════════════════════════════════
   Encontra o container rolável da área de participantes
   ══════════════════════════════════════════════════════════ */
function findScrollablePanel() {
  // Tenta data-testid
  for (const id of ['group-info-drawer','contact-info-panel','contact-info-drawer','app-viewer','participant-list']) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }

  const rightX = window.innerWidth * 0.3;
  // Painel rolável no lado direito
  for (const el of document.querySelectorAll('div')) {
    if (el.clientWidth < 150 || el.clientWidth > 700) continue;
    if (el.scrollHeight <= el.clientHeight + 20) continue;
    const s    = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && rect.left >= rightX) return el;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   Aguarda telefone aparecer no DOM (perfil individual aberto)
   ══════════════════════════════════════════════════════════ */
async function waitForPhone(timeout = 3500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (document.querySelector('[data-testid="contact-phone-number"]')) return true;
    for (const s of document.querySelectorAll('span[dir="ltr"]')) {
      const t = s.textContent.trim();
      if (looksLikePhone(t) && t.length <= 22) return true;
    }
    await sleep(250);
  }
  return false;
}

/* ── Extrai nome e telefone do painel de perfil aberto ── */
async function extractFromProfilePanel() {
  let phone = '';
  let name  = '';

  // Telefone — data-testid
  const phoneEl = document.querySelector('[data-testid="contact-phone-number"]');
  if (phoneEl) phone = normalizePhone(phoneEl.textContent.trim());

  // Telefone — spans ltr (números)
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

  // Nome — header do perfil
  for (const sel of [
    '[data-testid="contact-info-header"] span[dir="auto"]',
    '[data-testid="contact-name"]',
    '[data-testid="contact-display-name"]',
    'h1 span[dir="auto"]', 'h2 span[dir="auto"]',
  ]) {
    const el = document.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (t.length >= 2 && !looksLikePhone(t)) { name = t; break; }
    }
  }

  // Nome — fallback: primeiro span[title] ou span[dir=auto] relevante
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
  for (const sel of ['[data-testid="back"]','[data-testid="btn-back"]',
                     'button[aria-label="Back"]','button[aria-label="Voltar"]',
                     '[data-testid*="back"]']) {
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
   Extração principal
   ══════════════════════════════════════════════════════════ */
async function extractParticipants(targetCount) {
  await sleep(800);

  // Tenta expandir a lista de participantes
  await tryExpandParticipants();
  await sleep(800);

  const processed  = new Set();
  const leads      = [];
  let   noProgress = 0;
  const panel      = findScrollablePanel();

  while (leads.length < targetCount && noProgress < 12) {
    const items = findParticipantItems();

    // Filtra os não processados
    const unprocessed = items.filter(el => !processed.has(getItemKey(el)));

    if (!unprocessed.length) {
      // Sem item novo — rola para baixo
      if (panel) {
        const before = panel.scrollTop;
        panel.scrollTop += 600;
        await sleep(500);
        if (panel.scrollTop === before) break;
      } else {
        // Tenta rolar a janela
        window.scrollBy(0, 400);
        await sleep(500);
      }
      noProgress++;
      continue;
    }

    noProgress = 0;
    const target    = unprocessed[0];
    const targetKey = getItemKey(target);
    processed.add(targetKey);

    // Clica no participante
    target.scrollIntoView({ block: 'center' });
    await sleep(300);
    simulateClick(target);

    // Aguarda o perfil abrir (só verifica telefone, não botão Voltar)
    const opened = await waitForPhone(3500);

    if (opened) {
      await sleep(200);
      const { name, phone } = await extractFromProfilePanel();
      await clickBack();
      await sleep(600);

      if ((name || phone) && name !== 'Você' && name !== 'You') {
        leads.push({ name: name || phone, phone });
      }
    }
    // Se não abriu, apenas pula — não chama clickBack para não fechar o painel do grupo
  }

  if (!leads.length) {
    return {
      ok: false,
      error: 'Nenhum participante encontrado. Certifique-se de que o painel de informações do grupo está aberto e os participantes estão visíveis na tela.',
    };
  }

  return { ok: true, leads, total: leads.length };
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ ok: true }); return false; }
  if (msg.type === 'EXTRACT_PARTICIPANTS') {
    extractParticipants(msg.targetCount || 200).then(result => sendResponse(result));
    return true;
  }
});
