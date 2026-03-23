/* ══════════════════════════════════════════════════════════
   Content Script — Extrator WhatsApp
   Extrai participantes do painel de info do grupo aberto
   ══════════════════════════════════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function looksLikePhone(text) {
  if (!text) return false;
  const cleaned = text.replace(/[\s\-\.\(\)+]/g, '');
  return /^\d{10,15}$/.test(cleaned);
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

/* ── Extrai nome/telefone de um elemento de lista ── */
function extractLeadFromItem(el) {
  const spans = Array.from(el.querySelectorAll('span[dir="auto"], span[dir="ltr"], span[title]'));
  const texts = [];

  // Prioriza span[title] pois costuma ter o nome exato
  for (const s of spans) {
    const t = (s.getAttribute('title') || s.textContent || '').trim();
    if (t && !texts.includes(t)) texts.push(t);
  }

  // Fallback: divs com texto curto (nomes/telefones)
  if (!texts.length) {
    const divs = Array.from(el.querySelectorAll('div'));
    for (const d of divs) {
      if (d.children.length === 0) {
        const t = d.textContent.trim();
        if (t && t.length <= 60 && !texts.includes(t)) texts.push(t);
      }
    }
  }

  let phone = '';
  let name  = '';

  for (const t of texts) {
    if (looksLikePhone(t)) {
      if (!phone) phone = normalizePhone(t);
    } else if (!name && t.length >= 2) {
      name = t;
    }
  }

  return { name, phone };
}

/* ── Encontra o painel de informações do grupo ── */
function findInfoPanel() {
  // Estratégia 1: data-testid conhecidos (WhatsApp Web muda com frequência)
  const testIds = [
    'group-info-drawer',
    'contact-info-panel',
    'contact-info-drawer',
    'group-participants-list',
    'participant-list',
    'participant-list-scroll',
    'app-viewer',
  ];
  for (const id of testIds) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }

  // Estratégia 2: painel rolável no lado direito da tela que contenha items de lista
  const allDivs = Array.from(document.querySelectorAll('div'));
  for (const el of allDivs) {
    if (el.clientWidth < 200 || el.clientWidth > 600) continue;
    if (el.scrollHeight <= el.clientHeight + 30)      continue;
    const style = window.getComputedStyle(el);
    if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
    // Deve conter pelo menos 2 items de lista de algum tipo
    const items = el.querySelectorAll(
      '[data-testid="cell-frame-container"], [data-testid*="list-item"], ' +
      '[role="listitem"], [data-testid*="contact"], [data-testid*="participant"]'
    );
    if (items.length >= 2) return el;
  }

  // Estratégia 3: procura pelo heading "Participantes" e sobe para o container pai
  const headings = Array.from(document.querySelectorAll('span, div, h2, h3, p'));
  for (const h of headings) {
    if (h.children.length > 0) continue;
    const txt = h.textContent.trim().toLowerCase();
    if (txt === 'participantes' || txt === 'participants' ||
        txt.startsWith('participantes (') || txt.startsWith('participants (')) {
      // Sobe até achar um container com overflow
      let parent = h.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const s = window.getComputedStyle(parent);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && parent.clientWidth > 150) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }
  }

  return null;
}

/* ── Encontra items de participante dentro de um container ── */
function findParticipantItems(container) {
  // Tenta seletores conhecidos em ordem de especificidade
  const selectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid*="list-item"]',
    '[data-testid*="participant"]',
    '[data-testid*="contact-list-item"]',
    '[role="listitem"]',
  ];

  for (const sel of selectors) {
    const items = container.querySelectorAll(sel);
    if (items.length >= 2) return Array.from(items);
  }

  // Fallback: filhos diretos que têm altura compatível com item de lista (40–80px)
  // e contêm spans com texto
  const candidates = Array.from(container.querySelectorAll('div > div > div'));
  const likeItems = candidates.filter(el => {
    const h = el.getBoundingClientRect().height;
    if (h < 35 || h > 90) return false;
    const spans = el.querySelectorAll('span[dir="auto"], span[dir="ltr"]');
    return spans.length >= 1;
  });

  // Remove duplicatas (elementos pai/filho)
  const unique = likeItems.filter(el =>
    !likeItems.some(other => other !== el && other.contains(el))
  );

  return unique;
}

/* ── Extração principal ── */
async function extractParticipants(targetCount) {
  await sleep(600);

  const panel = findInfoPanel();

  if (!panel) {
    // Tentativa de emergência: busca direto no documento com seletores amplos
    const docItems = document.querySelectorAll(
      '[data-testid="cell-frame-container"], [data-testid*="list-item"], [role="listitem"]'
    );
    if (docItems.length >= 2) {
      const leads = processItems(Array.from(docItems));
      if (leads.length >= 2) return { ok: true, leads, total: leads.length };
    }

    return {
      ok: false,
      error: 'Painel de participantes não encontrado. Certifique-se de que o painel de informações do grupo está aberto (clique no nome do grupo) e role até ver os participantes. Depois clique em Extrair.',
    };
  }

  const seen   = new Set();
  const leads  = [];
  let noNewRounds = 0;
  let prevCount   = 0;

  while (leads.length < targetCount && noNewRounds < 12) {
    const items    = findParticipantItems(panel);
    const newLeads = processItems(items);

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

    panel.scrollTop += 700;
    await sleep(500);

    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 50) break;
  }

  if (!leads.length) {
    return {
      ok: false,
      error: 'Nenhum participante encontrado. Role manualmente o painel de informações do grupo até os participantes aparecerem e tente novamente.',
    };
  }

  return { ok: true, leads, total: leads.length };
}

/* ── Processa array de elementos → leads ── */
function processItems(items) {
  const leads = [];
  const seen  = new Set();

  for (const item of items) {
    const { name, phone } = extractLeadFromItem(item);
    const key = phone || name;
    if (!key || seen.has(key)) continue;
    if (name === 'Você' || name === 'You' || name.length < 2) continue;
    seen.add(key);
    leads.push({ name, phone });
  }

  return leads;
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'EXTRACT_PARTICIPANTS') {
    extractParticipants(msg.targetCount || 5000).then(result => sendResponse(result));
    return true;
  }
});
