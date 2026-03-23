/* ══════════════════════════════════════════════════════════
   Content Script — Extrator WhatsApp
   Injeta painel flutuante diretamente no WhatsApp Web
   ══════════════════════════════════════════════════════════ */

/* ── Utilidades ── */
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

/* ── Extrai leads de uma lista de elementos ── */
function extractFromItems(items) {
  const seen = new Set();
  const leads = [];
  items.forEach(item => {
    const spans = Array.from(item.querySelectorAll('span[dir="auto"], span[dir="ltr"]'));
    const texts = spans.map(s => s.textContent?.trim()).filter(Boolean);
    let phone = '', name = texts[0] || '';
    if (looksLikePhone(texts[0])) {
      phone = normalizePhone(texts[0]); name = '';
    } else {
      for (const t of texts.slice(1)) {
        if (looksLikePhone(t)) { phone = normalizePhone(t); break; }
      }
    }
    const key = phone || name;
    if (!key || seen.has(key)) return;
    if (name === 'Você' || name === 'You' || name.length < 2) return;
    seen.add(key);
    leads.push({ name, phone });
  });
  return leads;
}

/* O painel de info do grupo fica na DIREITA da tela.
   A lista de conversas fica na ESQUERDA — mesmos seletores, lado errado. */
const RIGHT_THRESHOLD = () => window.innerWidth * 0.5;

function isOnRightSide(el) {
  const rect = el.getBoundingClientRect();
  return rect.left >= RIGHT_THRESHOLD() && rect.width > 50;
}

function findItems(container) {
  for (const sel of [
    '[data-testid="cell-frame-container"]',
    '[data-testid*="list-item"]',
    '[data-testid*="contact-list-item"]',
    '[data-testid*="participant"]',
    '[role="listitem"]',
  ]) {
    const items = Array.from(container.querySelectorAll(sel))
      .filter(isOnRightSide);
    if (items.length >= 2) return items;
  }
  // Fallback geométrico — só lado direito
  const all = Array.from(container.querySelectorAll('div'));
  const candidates = all.filter(el => {
    if (!isOnRightSide(el)) return false;
    const h = el.getBoundingClientRect().height;
    return h >= 40 && h <= 90 && el.querySelectorAll('span[dir="auto"], span[dir="ltr"]').length >= 1;
  });
  return candidates.filter(el => !candidates.some(o => o !== el && o.contains(el)));
}

function findInfoPanel() {
  // data-testid específicos (painel de info)
  for (const id of ['contact-info-panel','group-info-drawer','contact-info-drawer',
                    'group-participants-list','participant-list','participant-list-scroll']) {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el) return el;
  }

  // Painel rolável no LADO DIREITO da tela
  for (const el of document.querySelectorAll('div')) {
    if (el.scrollHeight <= el.clientHeight + 30 || el.clientWidth < 150 || el.clientWidth > 600) continue;
    const s    = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (s.overflowY !== 'auto' && s.overflowY !== 'scroll') continue;
    if (rect.left < RIGHT_THRESHOLD()) continue; // ignora lado esquerdo
    if (findItems(el).length >= 2) return el;
  }

  // Sobe a partir do heading "Participantes" — garante que está na direita
  for (const el of document.querySelectorAll('span, div, p')) {
    if (el.children.length > 0) continue;
    if (!isOnRightSide(el)) continue;
    const txt = el.textContent.trim().toLowerCase();
    if (txt === 'participantes' || txt === 'participants' ||
        /^\d+\s+participantes?$/.test(txt) || /^\d+\s+members?$/.test(txt)) {
      let parent = el.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        const s = window.getComputedStyle(parent);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && parent.clientWidth > 150) return parent;
        parent = parent.parentElement;
      }
    }
  }
  return null;
}

/* ── Clica em "Ver tudo / Ver mais participantes" se existir ── */
async function tryClickVerMais() {
  // data-testid direto
  for (const sel of ['[data-testid="see-all-participants"]','[data-testid*="see-all"]','[data-testid*="view-all"]']) {
    const btn = document.querySelector(sel);
    if (btn) { simulateClick(btn); await sleep(1200); return true; }
  }

  // Termos em PT e EN — inclui "Ver tudo" que é o texto real no WhatsApp PT
  const terms = [
    'ver tudo', 'ver todos', 'ver mais', 'view all', 'view more', 'show all', 'show more', 'see all', 'see more',
  ];

  // Busca em toda a metade direita (não só no painel, pois o botão pode estar num container pai)
  for (const el of document.querySelectorAll('[role="button"], button, span, div')) {
    const rect = el.getBoundingClientRect();
    // Lado direito: left > 40% da largura (um pouco mais permissivo)
    if (rect.left < window.innerWidth * 0.4) continue;
    if (!el.offsetParent) continue;
    const txt = (el.textContent || '').trim().toLowerCase();
    if (terms.some(t => txt === t) || txt.includes('participante')) {
      // Só clica se o texto for curto (botão, não um parágrafo)
      if (txt.length <= 50) {
        simulateClick(el);
        await sleep(1200);
        return true;
      }
    }
  }
  return false;
}

async function extractParticipants(targetCount, onProgress) {
  await sleep(600);
  // Clica em "Ver mais participantes" se aparecer
  await tryClickVerMais();

  const panel = findInfoPanel();

  if (!panel) {
    return { ok: false, error: 'Painel de participantes não encontrado. Clique no nome do grupo para abrir as Informações do grupo.' };
  }

  const seen = new Set();
  const leads = [];
  let noNewRounds = 0, prevCount = 0;

  while (leads.length < targetCount && noNewRounds < 12) {
    const newLeads = extractFromItems(findItems(panel));
    for (const lead of newLeads) {
      const key = lead.phone || lead.name;
      if (!key || seen.has(key)) continue;
      seen.add(key); leads.push(lead);
    }
    if (leads.length === prevCount) noNewRounds++;
    else { noNewRounds = 0; prevCount = leads.length; }

    if (onProgress) onProgress(leads.length);

    // Tenta rolar de múltiplas formas (WhatsApp Web usa virtual scrolling)
    const before = panel.scrollTop;
    panel.scrollTop += 600;
    if (panel.scrollTop === before) {
      // scrollTop não mudou — tenta scroll() e wheel event
      panel.scroll({ top: panel.scrollTop + 600, behavior: 'instant' });
      panel.dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true }));
    }
    await sleep(600);

    // Para se chegou ao fim
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 50) break;
  }

  if (!leads.length) return { ok: false, error: 'Nenhum participante encontrado. Certifique-se de que o painel de informações está aberto.' };
  return { ok: true, leads };
}

/* ══════════════════════════════════════════════════════════
   PAINEL FLUTUANTE — injeta Shadow DOM no WhatsApp Web
   ══════════════════════════════════════════════════════════ */

const PANEL_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; }
  .panel {
    position: fixed; top: 48px; right: 8px; z-index: 2147483647;
    width: 310px; background: #111113; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    color: #e4e4e7; font-size: 13px; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .header {
    padding: 12px 14px; background: #18181b;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: space-between;
  }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .logo-icon {
    width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    background: linear-gradient(135deg,hsl(192,91%,52%),hsl(265,80%,60%));
    display: flex; align-items: center; justify-content: center;
  }
  .title { font-size: 13px; font-weight: 700; }
  .close-btn {
    background: none; border: none; color: #71717a; font-size: 18px;
    cursor: pointer; padding: 0 4px; line-height: 1;
  }
  .close-btn:hover { color: #e4e4e7; }
  .body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .field label {
    display: block; font-size: 10px; font-weight: 700; color: #a1a1aa;
    margin-bottom: 4px; text-transform: uppercase; letter-spacing: .05em;
  }
  .field input {
    width: 100%; background: #18181b; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; padding: 7px 10px; color: #e4e4e7; font-size: 12px;
    outline: none; font-family: inherit;
  }
  .field input:focus { border-color: #22c55e; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn {
    padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: none; font-family: inherit; display: flex;
    align-items: center; justify-content: center; gap: 5px;
  }
  .btn-primary { background: #22c55e; color: #000; }
  .btn-primary:hover { background: #4ade80; }
  .btn-primary:disabled { opacity: .45; cursor: not-allowed; }
  .btn-secondary { background: #1e1e22; border: 1px solid rgba(255,255,255,0.1); color: #e4e4e7; }
  .btn-secondary:hover { background: #27272a; }
  .btn-secondary:disabled { opacity: .45; cursor: not-allowed; }
  .btn-row { display: flex; gap: 7px; }
  .status {
    font-size: 11px; padding: 7px 10px; border-radius: 8px;
    display: none; line-height: 1.4;
  }
  .status.show { display: block; }
  .status.ok   { background: rgba(34,197,94,.12);  color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
  .status.err  { background: rgba(248,113,113,.12); color: #f87171; border: 1px solid rgba(248,113,113,.2); }
  .status.info { background: #1e1e22; color: #a1a1aa; border: 1px solid rgba(255,255,255,.08); }
  .progress { display: none; flex-direction: column; gap: 4px; }
  .progress.show { display: flex; }
  .progress-label { font-size: 10px; color: #a1a1aa; }
  .progress-track { height: 3px; background: #27272a; border-radius: 99px; overflow: hidden; }
  .progress-bar   { height: 100%; background: #22c55e; border-radius: 99px; transition: width .3s; width: 0%; }
  .divider { border: none; border-top: 1px solid rgba(255,255,255,.07); }
`;

const PANEL_HTML = `
  <div class="panel" id="panel">
    <div class="header">
      <div class="header-left">
        <div class="logo-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
            <path d="M14 2 L6 14 H11 L10 22 L18 10 H13 Z" fill="hsl(222,47%,6%)"/>
          </svg>
        </div>
        <span class="title">Extrator WhatsApp</span>
      </div>
      <button class="close-btn" id="closeBtn">✕</button>
    </div>
    <div class="body">
      <div class="row">
        <div class="field">
          <label>Pasta (opcional)</label>
          <input id="folder" type="text" placeholder="ex.: Grupo SP" />
        </div>
        <div class="field">
          <label>Limite</label>
          <input id="limit" type="number" value="200" min="1" max="5000" />
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="startBtn" style="flex:1">▶ Iniciar extração</button>
      </div>
      <div class="progress" id="progressBlock">
        <div class="progress-label" id="progressLabel">Aguardando...</div>
        <div class="progress-track"><div class="progress-bar" id="progressBar"></div></div>
      </div>
      <div class="status" id="extractStatus"></div>
      <hr class="divider" />
      <div class="btn-row">
        <button class="btn btn-primary" id="sendBtn" style="flex:1" disabled>📤 Enviar leads</button>
        <button class="btn btn-secondary" id="csvBtn" disabled>CSV</button>
      </div>
      <div class="status" id="sendStatus"></div>
    </div>
  </div>
`;

let _panelHost   = null;
let _panelShadow = null;
let _leads       = [];
let _running     = false;

function showStatus(shadow, id, text, type) {
  const el = shadow.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'status' + (text ? (' show ' + type) : '');
}

function setProgress(shadow, text, pct) {
  const block = shadow.getElementById('progressBlock');
  const label = shadow.getElementById('progressLabel');
  const bar   = shadow.getElementById('progressBar');
  if (!text) { block.classList.remove('show'); return; }
  block.classList.add('show');
  label.textContent = text;
  if (pct != null) bar.style.width = Math.min(100, pct) + '%';
}

function loadConfigJson() {
  return fetch(chrome.runtime.getURL('config.json'))
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (!cfg?.tenantId || !cfg?.extensionToken || !cfg?.webhookUrl) return;
      chrome.storage.local.set({
        tenantId:       String(cfg.tenantId),
        extensionToken: String(cfg.extensionToken),
        webhookUrl:     String(cfg.webhookUrl),
        preConfigured:  true,
      });
    })
    .catch(() => {});
}

function initPanel(shadow) {
  // Garante que config.json foi carregado no storage
  loadConfigJson().then(() => {
    chrome.storage.local.get(['folder','limit','tenantId','extensionToken','webhookUrl'], data => {
      if (data.folder) shadow.getElementById('folder').value = data.folder;
      if (data.limit)  shadow.getElementById('limit').value  = data.limit;
    });
  });

  // Fechar
  shadow.getElementById('closeBtn').addEventListener('click', () => {
    _panelHost.style.display = 'none';
  });

  // Iniciar extração
  shadow.getElementById('startBtn').addEventListener('click', async () => {
    if (_running) return;
    const folder = shadow.getElementById('folder').value.trim();
    const limit  = parseInt(shadow.getElementById('limit').value || '200', 10);
    chrome.storage.local.set({ folder, limit });

    _running = true;
    _leads   = [];
    const startBtn = shadow.getElementById('startBtn');
    const sendBtn  = shadow.getElementById('sendBtn');
    const csvBtn   = shadow.getElementById('csvBtn');
    startBtn.disabled = true;
    startBtn.textContent = '⏳ Extraindo...';
    sendBtn.disabled = true;
    csvBtn.disabled  = true;
    showStatus(shadow, 'extractStatus', '', '');
    setProgress(shadow, 'Buscando participantes...', 5);

    const result = await extractParticipants(limit, count => {
      setProgress(shadow, `${count} participantes encontrados...`, Math.min(95, 5 + count));
    });

    _running = false;
    startBtn.disabled = false;
    startBtn.textContent = '▶ Iniciar extração';

    if (!result.ok) {
      setProgress(shadow, null);
      showStatus(shadow, 'extractStatus', result.error, 'err');
      return;
    }

    _leads = result.leads;
    const withPhone = _leads.filter(l => l.phone).length;
    setProgress(shadow, `✅ ${_leads.length} participantes · ${withPhone} com telefone`, 100);
    showStatus(shadow, 'extractStatus', '', '');

    chrome.storage.local.set({ lastLeads: _leads });

    sendBtn.disabled = withPhone === 0;
    csvBtn.disabled  = _leads.length === 0;
  });

  // Enviar para SaaS
  shadow.getElementById('sendBtn').addEventListener('click', async () => {
    chrome.storage.local.get(['tenantId','extensionToken','webhookUrl'], async data => {
      const folder = shadow.getElementById('folder').value.trim();
      const leads  = _leads.length ? _leads : [];
      const withPhone = leads.filter(l => l.phone?.trim());

      if (!data.tenantId || !data.extensionToken || !data.webhookUrl) {
        showStatus(shadow, 'sendStatus', 'Configure Tenant, Token e Webhook no painel LeadFlowAI.', 'err'); return;
      }
      if (!withPhone.length) {
        showStatus(shadow, 'sendStatus', 'Nenhum lead com telefone para enviar.', 'err'); return;
      }

      showStatus(shadow, 'sendStatus', `Enviando ${withPhone.length} leads...`, 'info');

      // Fetch via background.js (evita CORS — content script tem origem web.whatsapp.com)
      chrome.runtime.sendMessage({
        type:    'DO_FETCH',
        url:     data.webhookUrl,
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-tenant-id':       data.tenantId,
          'x-extension-token': data.extensionToken,
        },
        body: {
          leads: withPhone.map(l => ({ company: l.name || l.phone, phone: l.phone.trim(), folder_name: folder || undefined })),
          source: 'whatsapp',
        },
      }, resp => {
        if (!resp?.ok) {
          showStatus(shadow, 'sendStatus', 'Erro ao enviar: ' + (resp?.text || resp?.error || 'desconhecido'), 'err');
          return;
        }
        let r = {};
        try { r = JSON.parse(resp.text); } catch {}
        showStatus(shadow, 'sendStatus', `✅ ${r.inserted ?? withPhone.length} leads enviados!`, 'ok');
      });
    });
  });

  // Exportar CSV
  shadow.getElementById('csvBtn').addEventListener('click', () => {
    const leads = _leads.length ? _leads : [];
    if (!leads.length) return;
    const folder = shadow.getElementById('folder').value.trim() || 'whatsapp';
    const rows = [['name','phone'], ...leads.map(l => [l.name||'', l.phone||''])];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    chrome.downloads.download({ url, filename: `whatsapp-${folder}.csv`, saveAs: true });
  });
}

function createOrShowPanel() {
  if (_panelHost) {
    _panelHost.style.display = _panelHost.style.display === 'none' ? 'block' : 'none';
    return;
  }

  _panelHost = document.createElement('div');
  _panelHost.id = '__leadflow_wa_panel__';
  _panelHost.style.cssText = 'all:unset;position:fixed;z-index:2147483647;';
  document.body.appendChild(_panelHost);

  _panelShadow = _panelHost.attachShadow({ mode: 'open' });
  _panelShadow.innerHTML = `<style>${PANEL_CSS}</style>${PANEL_HTML}`;
  initPanel(_panelShadow);
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING')         { sendResponse({ ok: true }); return false; }
  if (msg.type === 'TOGGLE_PANEL') { createOrShowPanel(); sendResponse({ ok: true }); return false; }
  if (msg.type === 'EXTRACT_PARTICIPANTS') {
    extractParticipants(msg.targetCount || 5000).then(result => sendResponse(result));
    return true;
  }
});
