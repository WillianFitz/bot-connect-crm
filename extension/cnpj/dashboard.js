/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator CNPJ (Casa dos Dados)

   Fase 1: preenche filtros, clica Pesquisar, coleta lista de
           empresas (CNPJ + nome + URL) paginando até o limite.
   Fase 2: abre cada empresa, extrai telefone / WhatsApp / email.
   ══════════════════════════════════════════════════════════ */

const SEARCH_URL = 'https://portal.casadosdados.com.br/plataforma/pesquisa';

/* ── Escapa HTML para prevenir XSS no innerHTML ── */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let _stopped      = false;
let _companies    = [];   // {cnpj, name, url}         — Fase 1
let _leads        = [];   // {cnpj, name, phone, email, notes} — Fase 2
let _searchKey    = null;

/* ── Navegação ── */
function switchSection(id) {
  document.querySelectorAll('.section').forEach(s =>
    s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-section') === id.replace('section-', '')));
  const titles = { capture: 'Extração de Leads via CNPJ', dashboard: 'Resultados', config: 'Configuração' };
  document.getElementById('topbarTitle').textContent = titles[id.replace('section-', '')] || 'LeadFlowAI';
}

/* ── Status / progresso ── */
function setStatus(elId, text, type = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'status-msg' + (text ? ' show s-' + type : '');
}

function setProgress(text, pct = null) {
  const block = document.getElementById('progressBlock');
  const label = document.getElementById('captureProgress');
  const bar   = document.getElementById('progressBar');
  if (!text) { block.classList.remove('show'); return; }
  block.classList.add('show');
  label.textContent = text;
  if (pct !== null) bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

/* ── Stats ── */
function updateStats(companies, leads, totalAvailable) {
  document.getElementById('stat-total').textContent     = totalAvailable != null ? totalAvailable.toLocaleString('pt-BR') : '—';
  document.getElementById('stat-extracted').textContent = companies.length;
  document.getElementById('stat-phones').textContent    = leads.filter(l => l.phone).length;
  document.getElementById('stat-emails').textContent    = leads.filter(l => l.email).length;
}

/* ── Botões ── */
function enableStartButton() {
  const btn  = document.getElementById('startCapture');
  const stop = document.getElementById('stopCapture');
  if (btn)  { btn.disabled = false; btn.textContent = '▶ Iniciar extração'; }
  if (stop) stop.style.display = 'none';
}
function disableStartButton() {
  const btn  = document.getElementById('startCapture');
  const stop = document.getElementById('stopCapture');
  if (btn)  { btn.disabled = true; btn.textContent = '⏳ Extraindo...'; }
  if (stop) stop.style.display = 'inline-flex';
}

function getSearchKey(uf, termo, situacao) {
  return `cnpj:${uf}:${(termo || '').toLowerCase().trim()}:${situacao}`;
}

/* ── sendWithRetry ── */
function sendWithRetry(tabId, message, callback, maxTries = 12, baseDelay = 1500) {
  let tries = 0;
  function attempt() {
    tries++;
    chrome.tabs.sendMessage(tabId, message, resp => {
      if (chrome.runtime.lastError) {
        if (tries < maxTries) { setTimeout(attempt, baseDelay + tries * 300); return; }
        chrome.scripting.executeScript({ target: { tabId }, files: ['content-script.js'] }, () => {
          setTimeout(() => chrome.tabs.sendMessage(tabId, message, r => callback(r || null)), 2500);
        });
        return;
      }
      callback(resp || null);
    });
  }
  setTimeout(attempt, 3000);
}

/* ── waitTabComplete ── */
function waitTabComplete(tabId, callback, _deadline) {
  const deadline = _deadline || (Date.now() + 15000);
  if (Date.now() >= deadline) { callback(); return; }
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab) { callback(); return; }
    if (tab.status === 'complete') { callback(); return; }
    const listener = (id, info) => {
      if (id !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      callback();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      callback();
    }, Math.max(0, deadline - Date.now()));
  });
}

/* ══════════════════════════════════════════════════════════
   FASE 1 — Abre busca, preenche filtros, coleta lista
   ══════════════════════════════════════════════════════════ */
function runPhase1(tabId, filters, limit) {
  if (_stopped) { enableStartButton(); return; }

  setProgress('Abrindo Casa dos Dados...', 3);

  chrome.tabs.update(tabId, { url: SEARCH_URL }, () => {
    waitTabComplete(tabId, () => {
      setTimeout(() => {

        // Verifica login
        sendWithRetry(tabId, { type: 'CDADOS_CHECK_LOGIN' }, loginResp => {
          if (!loginResp?.loggedIn) {
            setStatus('captureStatus', '⚠️ Não está logado no Casa dos Dados. Acesse portal.casadosdados.com.br, faça login e tente novamente.', 'err');
            setProgress(null);
            enableStartButton();
            chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
            return;
          }

          setProgress('Preenchendo filtros...', 8);

          sendWithRetry(tabId, { type: 'CDADOS_FILL_AND_SEARCH', filters }, fillResp => {
            if (!fillResp?.ok) {
              setStatus('captureStatus', fillResp?.error || 'Não foi possível preencher o formulário.', 'err');
              setProgress(null);
              enableStartButton();
              chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
              return;
            }

            setProgress('Aguardando resultados da busca...', 15);

            sendWithRetry(tabId, { type: 'CDADOS_WAIT_RESULTS', timeout: 18000 }, waitResp => {
              if (_stopped) { enableStartButton(); return; }

              if (!waitResp?.ok || !waitResp.entries?.length) {
                setStatus('captureStatus', 'Nenhum resultado encontrado com os filtros informados.', 'err');
                setProgress(null);
                enableStartButton();
                chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
                return;
              }

              const totalAvailable = waitResp.pageInfo?.total || null;
              collectAllPages(tabId, waitResp.entries, waitResp.pageInfo, limit, totalAvailable);
            }, 6, 2000);
          }, 8, 2000);
        }, 8, 2000);

      }, 4000); // aguarda hidratação Nuxt
    });
  });
}

/* ── Coleta todas as páginas de resultados ── */
function collectAllPages(tabId, pageEntries, pageInfo, limit, totalAvailable) {
  if (_stopped) { runPhase2(tabId, limit, totalAvailable); return; }

  // Adiciona novos (sem duplicatas por CNPJ)
  const seen = new Set(_companies.map(c => c.cnpj));
  pageEntries.forEach(e => {
    if (!seen.has(e.cnpj)) { seen.add(e.cnpj); _companies.push(e); }
  });

  updateStats(_companies, _leads, totalAvailable);
  setProgress(`Fase 1: ${_companies.length} empresas encontradas${totalAvailable ? ' de ' + totalAvailable.toLocaleString('pt-BR') : ''}`, 20);

  // Atingiu o limite ou não tem mais páginas
  if (_companies.length >= limit || !pageInfo?.hasNext) {
    _companies = _companies.slice(0, limit);
    updateStats(_companies, _leads, totalAvailable);
    setProgress(`Fase 1 concluída: ${_companies.length} empresas. Iniciando extração de detalhes...`, 25);
    runPhase2(tabId, limit, totalAvailable);
    return;
  }

  // Vai para próxima página
  setProgress(`Fase 1: coletando pág. ${(_companies.length / 100 + 1).toFixed(0)}... (${_companies.length}/${limit})`, 20);
  sendWithRetry(tabId, { type: 'CDADOS_NEXT_PAGE' }, nextResp => {
    if (_stopped) { runPhase2(tabId, limit, totalAvailable); return; }
    if (!nextResp?.ok) {
      _companies = _companies.slice(0, limit);
      runPhase2(tabId, limit, totalAvailable);
      return;
    }
    const nextInfo = { hasNext: nextResp.hasNext };
    collectAllPages(tabId, nextResp.entries || [], nextInfo, limit, totalAvailable);
  }, 6, 2000);
}

/* ══════════════════════════════════════════════════════════
   FASE 2 — Entra em cada empresa e extrai detalhes
   ══════════════════════════════════════════════════════════ */
function runPhase2(tabId, limit, totalAvailable) {
  if (_stopped) { finishExtraction(tabId, totalAvailable); return; }
  if (!_companies.length) { finishExtraction(tabId, totalAvailable); return; }

  let idx = _leads.length; // retoma do ponto onde parou

  function step() {
    if (_stopped || idx >= _companies.length) {
      finishExtraction(tabId, totalAvailable);
      return;
    }

    const company = _companies[idx];
    const pct = 25 + Math.round((idx / _companies.length) * 73);
    setProgress(`Fase 2: ${idx + 1}/${_companies.length} — aguardando...`, pct);
    updateStats(_companies, _leads, totalAvailable);

    // Navega para a página da empresa
    chrome.tabs.update(tabId, { url: company.url }, () => {
      waitTabComplete(tabId, () => {
        sendWithRetry(tabId, { type: 'CDADOS_EXTRACT_DETAILS' }, detailResp => {
          if (_stopped) { finishExtraction(tabId, totalAvailable); return; }

          const name  = detailResp?.name  || company.name  || company.cnpj;
          const phone = (detailResp?.phone || '').replace(/\D/g, '');
          const email = detailResp?.email || '';
          const notes = detailResp?.notes || '';

          setProgress(`Fase 2: ${idx + 1}/${_companies.length} — ${name}`, pct);
          _leads.push({ cnpj: company.cnpj, name, phone, email, notes, url: company.url });
          idx++;

          // Salva a cada 5
          if (idx % 5 === 0) {
            chrome.storage.local.get(['cnpjSearches'], data => {
              const searches = data.cnpjSearches || {};
              searches[_searchKey] = { companies: _companies, leads: _leads, totalAvailable };
              chrome.storage.local.set({ cnpjSearches: searches });
            });
            updateStats(_companies, _leads, totalAvailable);
          }

          // Delay humanizado 2–4s
          const delay = 2000 + Math.random() * 2000;
          setTimeout(step, delay);
        }, 8, 1500);
      });
    });
  }

  step();
}

/* ── Finaliza ── */
function finishExtraction(tabId, totalAvailable) {
  const withPhone = _leads.filter(l => l.phone).length;
  const withEmail = _leads.filter(l => l.email).length;

  // Salva resultado final
  chrome.storage.local.get(['cnpjSearches'], data => {
    const searches = data.cnpjSearches || {};
    searches[_searchKey] = { companies: _companies, leads: _leads, totalAvailable, timestamp: new Date().toISOString() };
    chrome.storage.local.set({ cnpjSearches: searches });
    renderSearchesTable(searches);
  });

  const msg = _stopped
    ? `⏹ Parado: ${_leads.length}/${_companies.length} empresas · ${withPhone} com telefone.`
    : `✅ ${_leads.length} empresas · ${withPhone} com telefone · ${withEmail} com e-mail.`;

  setProgress(`Concluído: ${_leads.length} leads`, 100);
  setStatus('captureStatus', msg, _stopped ? 'info' : 'ok');
  updateStats(_companies, _leads, totalAvailable);
  enableStartButton();

  chrome.tabs.get(tabId, t => {
    if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId);
  });
}

/* ── Tabela histórico ── */
function renderSearchesTable(searches) {
  const entries = Object.entries(searches || {});
  const body = document.getElementById('searchesBody');
  body.innerHTML = '';

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px">Nenhuma extração ainda.</td></tr>';
    document.getElementById('summary').textContent = 'Nenhuma extração realizada ainda.';
    return;
  }

  let totalL = 0, totalP = 0;
  entries.forEach(([key, s]) => {
    const extr   = (s.leads || []).length;
    const phones = (s.leads || []).filter(l => l.phone).length;
    const emails = (s.leads || []).filter(l => l.email).length;
    totalL += extr; totalP += phones;
    const parts = key.split(':');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(parts[2]) || '—'}</td>
      <td>${esc(parts[1]) || 'Todos'}</td>
      <td>${(s.companies || []).length} / ${extr}</td>
      <td>${phones > 0 ? `<span class="chip chip-green">📱 ${phones}</span>` : '<span class="chip chip-gray">0</span>'}</td>
      <td>${emails > 0 ? `<span class="chip chip-green">✉️ ${emails}</span>` : '<span class="chip chip-gray">0</span>'}</td>
    `;
    body.appendChild(tr);
  });

  document.getElementById('summary').textContent =
    `${entries.length} busca(s) · ${totalL} empresas detalhadas · ${totalP} com telefone`;
}

/* ── Helpers de data ── */
function padDate(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${padDate(d.getDate())}/${padDate(d.getMonth()+1)}/${d.getFullYear()}`; }

function setDateRange(days) {
  const today = new Date();
  const from  = new Date();
  from.setDate(today.getDate() - days);
  document.getElementById('dataAberturaInicio').value = fmtDate(from);
  document.getElementById('dataAberturaFim').value    = fmtDate(today);
}

function clearDates() {
  document.getElementById('dataAberturaInicio').value = '';
  document.getElementById('dataAberturaFim').value    = '';
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  function loadConfigJson() {
    return fetch(chrome.runtime.getURL('config.json'))
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (!cfg?.tenantId || !cfg?.extensionToken || !cfg?.webhookUrl) return;
        chrome.storage.local.set({ tenantId: String(cfg.tenantId), extensionToken: String(cfg.extensionToken), webhookUrl: String(cfg.webhookUrl), preConfigured: true }, () => {
          const el = document.getElementById('tenantId');
          if (el) { el.readOnly = true; el.title = 'Pré-configurado (somente leitura).'; }
        });
      }).catch(() => {});
  }

  /* ── Atalhos de data ── */
  document.getElementById('dateRange7').addEventListener('click',   () => setDateRange(7));
  document.getElementById('dateRange30').addEventListener('click',  () => setDateRange(30));
  document.getElementById('dateRange90').addEventListener('click',  () => setDateRange(90));
  document.getElementById('dateRange365').addEventListener('click', () => setDateRange(365));
  document.getElementById('clearDatesBtn').addEventListener('click', () => clearDates());

  /* ── Auto-formata data ao digitar ── */
  ['dataAberturaInicio','dataAberturaFim'].forEach(id => {
    document.getElementById(id).addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '');
      if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
      if (v.length > 5) v = v.slice(0,5) + '/' + v.slice(5,9);
      this.value = v;
    });
  });

  /* ── Switches visuais (fix: label já togla o cb, não toglar de novo) ── */
  document.querySelectorAll('.switch-item').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"]');
    function update() { label.classList.toggle('on', cb.checked); }
    update();
    cb.addEventListener('change', update);
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      switchSection(`section-${sec}`);
      if (sec === 'dashboard') chrome.storage.local.get(['cnpjSearches'], d => renderSearchesTable(d.cnpjSearches || {}));
    });
  });

  loadConfigJson().then(() => {
    chrome.storage.local.get(['tenantId', 'extensionToken', 'webhookUrl', 'preConfigured', 'cnpjSearches'], data => {
      if (data.tenantId)       document.getElementById('tenantId').value   = data.tenantId;
      if (data.extensionToken) document.getElementById('token').value      = data.extensionToken;
      if (data.webhookUrl)     document.getElementById('webhookUrl').value = data.webhookUrl;
      if (data.preConfigured)  { const el = document.getElementById('tenantId'); if (el) { el.readOnly = true; el.title = 'Pré-configurado.'; } }
      renderSearchesTable(data.cnpjSearches || {});
    });
  });

  document.getElementById('saveConfig').addEventListener('click', () => {
    const tenantId       = document.getElementById('tenantId').value.trim();
    const extensionToken = document.getElementById('token').value.trim();
    const webhookUrl     = document.getElementById('webhookUrl').value.trim();
    if (!tenantId || !extensionToken || !webhookUrl) { setStatus('configStatus', 'Preencha Tenant, Token e Webhook.', 'err'); return; }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl }, () => setStatus('configStatus', 'Configuração salva!', 'ok'));
  });

  document.getElementById('stopCapture').addEventListener('click', () => {
    _stopped = true;
    setStatus('captureStatus', '⏹ Extração interrompida. Leads coletados foram salvos.', 'info');
    setProgress(null);
  });

  document.getElementById('startCapture').addEventListener('click', () => {
    chrome.storage.local.get(['tenantId', 'extensionToken', 'webhookUrl'], data => {
      const tenantId       = document.getElementById('tenantId').value.trim()   || data.tenantId?.trim();
      const extensionToken = document.getElementById('token').value.trim()      || data.extensionToken?.trim();
      const webhookUrl     = document.getElementById('webhookUrl').value.trim() || data.webhookUrl?.trim();
      const limit          = parseInt(document.getElementById('limit').value || '50', 10);

      if (!tenantId || !extensionToken || !webhookUrl) {
        setStatus('captureStatus', 'Configure Tenant, Token e Webhook (aba Configuração).', 'err'); return;
      }

      const uf                 = document.getElementById('uf').value;
      const situacao           = document.getElementById('situacao').value;
      const termo              = document.getElementById('termo').value.trim();
      const cnae               = document.getElementById('cnae').value.trim();
      const ddd                = document.getElementById('ddd').value.trim();
      const municipio          = document.getElementById('municipio').value.trim();
      const bairro             = document.getElementById('bairro').value.trim();
      const cep                = document.getElementById('cep').value.trim();
      const telefone           = document.getElementById('telefone').value.trim();
      const dataAberturaInicio = document.getElementById('dataAberturaInicio').value.trim();
      const dataAberturaFim    = document.getElementById('dataAberturaFim').value.trim();
      const porte              = document.getElementById('porte').value;
      const naturezaJuridica   = document.getElementById('naturezaJuridica').value.trim();
      const capitalMin         = document.getElementById('capitalMin').value.trim();
      const capitalMax         = document.getElementById('capitalMax').value.trim();
      const comTelefone        = document.getElementById('comTelefone').checked;
      const somenteFixo        = document.getElementById('somenteFixo').checked;
      const somenteCelular     = document.getElementById('somenteCelular').checked;
      const comEmail           = document.getElementById('comEmail').checked;
      const somenteMEI         = document.getElementById('somenteMEI').checked;
      const excluirMEI         = document.getElementById('excluirMEI').checked;
      const somenteMatriz      = document.getElementById('somenteMatriz').checked;
      const somenteFilial      = document.getElementById('somenteFilial').checked;
      const empresasSimples    = document.getElementById('empresasSimples').checked;
      const excluirSimples     = document.getElementById('excluirSimples').checked;
      const excluirVisualizadas = document.getElementById('excluirVisualizadas').checked;
      const excluirContab      = document.getElementById('excluirContab').checked;

      if (!uf && !termo && !cnae && !municipio && !dataAberturaInicio) {
        setStatus('captureStatus', 'Informe pelo menos um filtro: UF, termo, CNAE, município ou data de abertura.', 'err'); return;
      }

      _stopped   = false;
      _companies = [];
      _leads     = [];
      _searchKey = getSearchKey(uf, termo || municipio || dataAberturaInicio, situacao);

      disableStartButton();
      setStatus('captureStatus', '', 'info');
      setProgress('Abrindo Casa dos Dados...', 2);
      updateStats([], [], null);

      const filters = {
        uf, situacao, termo, cnae, ddd,
        municipio, bairro, cep, telefone,
        dataAberturaInicio, dataAberturaFim,
        porte, naturezaJuridica, capitalMin, capitalMax,
        comTelefone, somenteFixo, somenteCelular, comEmail,
        somenteMEI, excluirMEI, somenteMatriz, somenteFilial,
        empresasSimples, excluirSimples, excluirVisualizadas, excluirContab,
      };

      chrome.windows.create({ url: 'about:blank', focused: false, width: 1280, height: 900 }, win => {
        if (win?.id) chrome.windows.update(win.id, { state: 'minimized' });
        const tab = win?.tabs?.[0];
        if (!tab?.id) {
          setStatus('captureStatus', 'Não foi possível abrir a janela.', 'err');
          enableStartButton(); return;
        }
        runPhase1(tab.id, filters, limit);
      });
    });
  });

  /* Enviar para SaaS */
  document.getElementById('sendToSaaS').addEventListener('click', () => {
    chrome.storage.local.get(['tenantId', 'extensionToken', 'webhookUrl', 'cnpjSearches'], async data => {
      const tenantId       = document.getElementById('tenantId').value.trim()   || data.tenantId?.trim();
      const extensionToken = document.getElementById('token').value.trim()      || data.extensionToken?.trim();
      const webhookUrl     = document.getElementById('webhookUrl').value.trim() || data.webhookUrl?.trim();

      if (!tenantId || !extensionToken || !webhookUrl) { setStatus('sendStatus', 'Configure Tenant, Token e Webhook.', 'err'); return; }

      const leads = _leads.length
        ? _leads
        : Object.values(data.cnpjSearches || {}).flatMap(s => s.leads || []);

      if (!leads.length) { setStatus('sendStatus', 'Nenhum lead disponível. Execute a extração primeiro.', 'err'); return; }

      const folder = document.getElementById('folder').value.trim() || null;
      const withPhone = leads.filter(l => l.phone?.trim());

      if (!withPhone.length) { setStatus('sendStatus', `Nenhum lead com telefone entre ${leads.length}.`, 'err'); return; }

      setStatus('sendStatus', `Enviando ${withPhone.length} leads...`, 'info');

      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId, 'x-extension-token': extensionToken },
          body: JSON.stringify({
            leads: withPhone.map(l => ({ company: l.name || 'Empresa', phone: l.phone, email: l.email || null, cnpj: l.cnpj || null, notes: l.notes || null, folder_name: folder })),
            source: 'cnpj',
          }),
        });
        if (!res.ok) { setStatus('sendStatus', 'Erro: ' + (await res.text() || res.statusText), 'err'); return; }
        const result = await res.json().catch(() => ({}));
        setStatus('sendStatus', `✅ ${result.inserted ?? withPhone.length} leads enviados!`, 'ok');
      } catch { setStatus('sendStatus', 'Erro de rede. Verifique o Webhook.', 'err'); }
    });
  });

  /* Exportar CSV */
  document.getElementById('exportCsv').addEventListener('click', () => {
    chrome.storage.local.get(['cnpjSearches'], data => {
      const leads = _leads.length ? _leads : Object.values(data.cnpjSearches || {}).flatMap(s => s.leads || []);
      if (!leads.length) { setStatus('sendStatus', 'Nenhum lead para exportar.', 'err'); return; }

      const rows = [
        ['cnpj', 'name', 'phone', 'email', 'notes'],
        ...leads.map(l => [l.cnpj||'', l.name||'', l.phone||'', l.email||'', l.notes||''])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
      chrome.downloads.download({ url, filename: `cnpj-leads-${new Date().toISOString().slice(0,10)}.csv`, saveAs: true }, () => {
        setStatus('sendStatus', `CSV exportado: ${leads.length} registros.`, 'ok');
      });
    });
  });

  document.querySelector('[data-section="capture"]').click();
});
