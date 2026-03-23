/* ══════════════════════════════════════════════════════════
   Dashboard — Extrator CNPJ (Casa dos Dados)
   Abre portal.casadosdados.com.br em janela minimizada,
   preenche filtros via content-script, scrapa resultados
   e envia leads para o LeadFlowAI.
   ══════════════════════════════════════════════════════════ */

const SEARCH_URL = 'https://portal.casadosdados.com.br/plataforma/pesquisa';

let _stopped   = false;
let _allLeads  = [];
let _searchKey = null;

/* ── Navegação ── */
function switchSection(id) {
  document.querySelectorAll('.section').forEach(s =>
    s.classList.toggle('active', s.id === id)
  );
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-section') === id.replace('section-', ''))
  );
  const titles = {
    capture: 'Extração de Leads via CNPJ',
    dashboard: 'Resultados',
    config: 'Configuração',
  };
  const key = id.replace('section-', '');
  document.getElementById('topbarTitle').textContent = titles[key] || 'LeadFlowAI';
}

/* ── Status / progresso ── */
function setStatus(elId, text, type = 'info') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'status-msg' + (text ? (' show s-' + type) : '');
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

/* ── Stats cards ── */
function updateStats(leads, totalAvailable) {
  const phones = leads.filter(l => l.phone).length;
  const emails = leads.filter(l => l.email).length;
  document.getElementById('stat-total').textContent     = totalAvailable != null ? totalAvailable.toLocaleString('pt-BR') : '—';
  document.getElementById('stat-extracted').textContent = leads.length;
  document.getElementById('stat-phones').textContent    = phones;
  document.getElementById('stat-emails').textContent    = emails;
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

/* ── Chave de busca ── */
function getSearchKey(uf, termo, situacao) {
  return `cnpj:${uf}:${(termo || '').toLowerCase().trim()}:${situacao}`;
}

/* ── Envio com retry (reinjecta content-script se necessário) ── */
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

/* ── Aguarda aba carregar ── */
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
   FASE PRINCIPAL — scraping paginado
   ══════════════════════════════════════════════════════════ */
function runExtraction(tabId, filters, limit, key) {
  if (_stopped) { enableStartButton(); return; }

  setProgress('Navegando para Casa dos Dados...', 5);

  chrome.tabs.update(tabId, { url: SEARCH_URL }, () => {
    waitTabComplete(tabId, () => {
      setTimeout(() => {
        // Verifica login
        sendWithRetry(tabId, { type: 'CDADOS_CHECK_LOGIN' }, resp => {
          if (!resp?.loggedIn) {
            setStatus('captureStatus', '⚠️ Você não está logado no Casa dos Dados. Faça login em portal.casadosdados.com.br e tente novamente.', 'err');
            setProgress(null);
            enableStartButton();
            chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
            return;
          }

          setProgress('Preenchendo filtros de busca...', 10);

          // Preenche o formulário e clica em Pesquisar
          sendWithRetry(tabId, { type: 'CDADOS_FILL_AND_SEARCH', filters }, fillResp => {
            if (!fillResp?.ok) {
              setStatus('captureStatus', fillResp?.error || 'Não foi possível preencher o formulário.', 'err');
              setProgress(null);
              enableStartButton();
              chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
              return;
            }

            setProgress('Aguardando resultados...', 18);

            // Aguarda resultados aparecerem
            sendWithRetry(tabId, { type: 'CDADOS_WAIT_RESULTS', timeout: 15000 }, waitResp => {
              if (_stopped) { enableStartButton(); return; }

              if (!waitResp?.ok || !waitResp.results?.length) {
                setStatus('captureStatus', 'Nenhum resultado encontrado com os filtros informados.', 'err');
                setProgress(null);
                enableStartButton();
                chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId); });
                return;
              }

              const total = waitResp.pageInfo?.total || null;
              processPage(tabId, waitResp.results, waitResp.pageInfo, limit, key, total);
            }, 8, 2000);
          }, 8, 2000);
        }, 8, 2000);
      }, 4000); // aguarda página renderizar
    });
  });
}

/* ── Processa uma página de resultados ── */
function processPage(tabId, pageResults, pageInfo, limit, key, totalAvailable) {
  if (_stopped) {
    finishExtraction(tabId, key, totalAvailable);
    return;
  }

  const newLeads = deduplicateLeads(pageResults, _allLeads);
  _allLeads = [..._allLeads, ...newLeads];

  const withPhone = _allLeads.filter(l => l.phone).length;
  const pct = limit > 0 ? Math.round((_allLeads.length / limit) * 95) : 50;
  setProgress(
    `Página ${pageInfo?.currentPage || '?'} · ${_allLeads.length} extraídos · ${withPhone} com telefone`,
    pct
  );
  updateStats(_allLeads, totalAvailable);

  chrome.storage.local.get(['cnpjSearches'], data => {
    const searches = data.cnpjSearches || {};
    searches[_searchKey] = { leads: _allLeads, totalAvailable, timestamp: new Date().toISOString() };
    chrome.storage.local.set({ cnpjSearches: searches });
  });

  // Verifica se atingiu o limite ou não há mais páginas
  if (_allLeads.length >= limit || !pageInfo?.hasNextPage) {
    finishExtraction(tabId, key, totalAvailable);
    return;
  }

  // Vai para próxima página
  setProgress(`Buscando próxima página... (${_allLeads.length}/${limit})`, pct);
  sendWithRetry(tabId, { type: 'CDADOS_NEXT_PAGE' }, nextResp => {
    if (_stopped) { finishExtraction(tabId, key, totalAvailable); return; }
    if (!nextResp?.ok) {
      finishExtraction(tabId, key, totalAvailable);
      return;
    }
    const nextInfo = { currentPage: (pageInfo?.currentPage || 1) + 1, hasNextPage: nextResp.hasMore };
    processPage(tabId, nextResp.results || [], nextInfo, limit, key, totalAvailable);
  }, 6, 2000);
}

/* ── Finaliza extração ── */
function finishExtraction(tabId, key, totalAvailable) {
  const withPhone = _allLeads.filter(l => l.phone).length;
  const withEmail = _allLeads.filter(l => l.email).length;

  const msg = _stopped
    ? `⏹ Parado: ${_allLeads.length} extraídos (${withPhone} com telefone).`
    : `✅ ${_allLeads.length} empresas · ${withPhone} com telefone · ${withEmail} com e-mail.`;

  setProgress(`Concluído: ${_allLeads.length} leads`, 100);
  setStatus('captureStatus', msg, _stopped ? 'info' : 'ok');
  updateStats(_allLeads, totalAvailable);
  enableStartButton();

  chrome.tabs.get(tabId, t => {
    if (!chrome.runtime.lastError && t?.windowId) chrome.windows.remove(t.windowId);
  });
}

/* ── Remove duplicatas por CNPJ ou phone ── */
function deduplicateLeads(newLeads, existing) {
  const seenCnpj  = new Set(existing.map(l => l.cnpj).filter(Boolean));
  const seenPhone = new Set(existing.map(l => l.phone).filter(Boolean));
  return newLeads.filter(l => {
    if (l.cnpj  && seenCnpj.has(l.cnpj))   return false;
    if (l.phone && seenPhone.has(l.phone))  return false;
    if (l.cnpj)  seenCnpj.add(l.cnpj);
    if (l.phone) seenPhone.add(l.phone);
    return true;
  });
}

/* ── Render tabela de histórico ── */
function renderSearchesTable(searches) {
  const entries = Object.entries(searches || {});
  const body = document.getElementById('searchesBody');
  body.innerHTML = '';

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px">Nenhuma extração ainda.</td></tr>';
    document.getElementById('summary').textContent = 'Nenhuma extração realizada ainda.';
    return;
  }

  let totalExtr = 0, totalPhones = 0;
  entries.forEach(([key, s]) => {
    const extr   = (s.leads || []).length;
    const phones = (s.leads || []).filter(l => l.phone).length;
    const emails = (s.leads || []).filter(l => l.email).length;
    totalExtr   += extr;
    totalPhones += phones;

    const parts = key.split(':');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${parts[2] || '—'}</td>
      <td>${parts[1] || 'Todos'}</td>
      <td>${extr}</td>
      <td>${phones > 0 ? `<span class="chip chip-green">📱 ${phones}</span>` : '<span class="chip chip-gray">0</span>'}</td>
      <td>${emails > 0 ? `<span class="chip chip-green">✉️ ${emails}</span>` : '<span class="chip chip-gray">0</span>'}</td>
    `;
    body.appendChild(tr);
  });

  document.getElementById('summary').textContent =
    `${entries.length} busca(s) · ${totalExtr} empresas · ${totalPhones} com telefone`;
}

/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* Pré-config do config.json */
  function loadConfigJson() {
    return fetch(chrome.runtime.getURL('config.json'))
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (!cfg || !cfg.tenantId || !cfg.extensionToken || !cfg.webhookUrl) return;
        chrome.storage.local.set({
          tenantId:       String(cfg.tenantId),
          extensionToken: String(cfg.extensionToken),
          webhookUrl:     String(cfg.webhookUrl),
          preConfigured:  true,
        }, () => {
          const el = document.getElementById('tenantId');
          if (el) { el.readOnly = true; el.title = 'Pré-configurado pelo painel (somente leitura).'; }
        });
      })
      .catch(() => {});
  }

  /* Navegação */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      switchSection(`section-${sec}`);
      if (sec === 'dashboard') {
        chrome.storage.local.get(['cnpjSearches'], d => renderSearchesTable(d.cnpjSearches || {}));
      }
    });
  });

  /* Carrega config salva */
  loadConfigJson().then(() => {
    chrome.storage.local.get(
      ['tenantId', 'extensionToken', 'webhookUrl', 'preConfigured', 'cnpjSearches'],
      data => {
        if (data.tenantId)       document.getElementById('tenantId').value    = data.tenantId;
        if (data.extensionToken) document.getElementById('token').value       = data.extensionToken;
        if (data.webhookUrl)     document.getElementById('webhookUrl').value  = data.webhookUrl;
        if (data.preConfigured) {
          const el = document.getElementById('tenantId');
          if (el) { el.readOnly = true; el.title = 'Pré-configurado pelo painel (somente leitura).'; }
        }
        renderSearchesTable(data.cnpjSearches || {});
      }
    );
  });

  /* Salvar configuração */
  document.getElementById('saveConfig').addEventListener('click', () => {
    const tenantId       = document.getElementById('tenantId').value.trim();
    const extensionToken = document.getElementById('token').value.trim();
    const webhookUrl     = document.getElementById('webhookUrl').value.trim();
    if (!tenantId || !extensionToken || !webhookUrl) {
      setStatus('configStatus', 'Preencha Tenant, Token e Webhook.', 'err'); return;
    }
    chrome.storage.local.set({ tenantId, extensionToken, webhookUrl }, () => {
      setStatus('configStatus', 'Configuração salva com sucesso.', 'ok');
    });
  });

  /* Parar extração */
  document.getElementById('stopCapture').addEventListener('click', () => {
    _stopped = true;
    setStatus('captureStatus', '⏹ Extração interrompida. Leads coletados foram salvos.', 'info');
    setProgress(null);
  });

  /* Iniciar extração */
  document.getElementById('startCapture').addEventListener('click', () => {
    chrome.storage.local.get(
      ['tenantId', 'extensionToken', 'webhookUrl'],
      data => {
        const tenantId       = document.getElementById('tenantId').value.trim()        || data.tenantId?.trim();
        const extensionToken = document.getElementById('token').value.trim()           || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById('webhookUrl').value.trim()      || data.webhookUrl?.trim();
        const limit          = parseInt(document.getElementById('limit').value || '100', 10);

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus('captureStatus', 'Configure Tenant, Token e Webhook (aba Configuração).', 'err'); return;
        }

        const uf            = document.getElementById('uf').value;
        const situacao      = document.getElementById('situacao').value;
        const termo         = document.getElementById('termo').value.trim();
        const cnae          = document.getElementById('cnae').value.trim();
        const ddd           = document.getElementById('ddd').value.trim();
        const comTelefone   = document.getElementById('comTelefone').checked;
        const comEmail      = document.getElementById('comEmail').checked;
        const somenteMEI    = document.getElementById('somenteMEI').checked;
        const excluirMEI    = document.getElementById('excluirMEI').checked;
        const somenteMatriz = document.getElementById('somenteMatriz').checked;

        if (!uf && !termo && !cnae) {
          setStatus('captureStatus', 'Informe pelo menos um filtro: UF, termo ou CNAE.', 'err'); return;
        }

        _stopped   = false;
        _allLeads  = [];
        _searchKey = getSearchKey(uf, termo, situacao);

        disableStartButton();
        setStatus('captureStatus', '', 'info');
        setProgress('Abrindo Casa dos Dados...', 3);
        updateStats([], null);

        const filters = { uf, situacao, termo, cnae, ddd, comTelefone, comEmail, somenteMEI, excluirMEI, somenteMatriz };

        chrome.windows.create({
          url: 'about:blank',
          focused: false,
          width: 1280,
          height: 900,
        }, win => {
          if (win?.id) chrome.windows.update(win.id, { state: 'minimized' });
          const tab = win?.tabs?.[0];
          if (!tab?.id) {
            setStatus('captureStatus', 'Não foi possível abrir a janela do Casa dos Dados.', 'err');
            enableStartButton();
            return;
          }
          runExtraction(tab.id, filters, limit, _searchKey);
        });
      }
    );
  });

  /* Enviar para SaaS */
  document.getElementById('sendToSaaS').addEventListener('click', () => {
    chrome.storage.local.get(
      ['tenantId', 'extensionToken', 'webhookUrl', 'cnpjSearches'],
      async data => {
        const tenantId       = document.getElementById('tenantId').value.trim()   || data.tenantId?.trim();
        const extensionToken = document.getElementById('token').value.trim()      || data.extensionToken?.trim();
        const webhookUrl     = document.getElementById('webhookUrl').value.trim() || data.webhookUrl?.trim();

        if (!tenantId || !extensionToken || !webhookUrl) {
          setStatus('sendStatus', 'Configure Tenant, Token e Webhook.', 'err'); return;
        }

        const leads = _allLeads.length
          ? _allLeads
          : Object.values(data.cnpjSearches || {}).flatMap(s => s.leads || []);

        if (!leads.length) {
          setStatus('sendStatus', 'Nenhum lead disponível. Execute a extração primeiro.', 'err'); return;
        }

        const folder = document.getElementById('folder').value.trim() || null;
        const leadsComTelefone = leads.filter(l => l.phone && l.phone.trim());

        if (!leadsComTelefone.length) {
          setStatus('sendStatus', `Nenhum lead com telefone entre ${leads.length} extraídos.`, 'err'); return;
        }

        setStatus('sendStatus', `Enviando ${leadsComTelefone.length} leads...`, 'info');

        const payload = leadsComTelefone.map(l => ({
          company:     l.name     || 'Empresa',
          phone:       l.phone,
          email:       l.email    || null,
          website:     l.website  || null,
          cnpj:        l.cnpj     || null,
          notes:       l.notes    || null,
          folder_name: folder,
        }));

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type':      'application/json',
              'x-tenant-id':       tenantId,
              'x-extension-token': extensionToken,
            },
            body: JSON.stringify({ leads: payload, source: 'cnpj' }),
          });

          if (!res.ok) {
            setStatus('sendStatus', 'Erro ao enviar: ' + (await res.text() || res.statusText), 'err');
            return;
          }

          const result = await res.json().catch(() => ({}));
          setStatus('sendStatus',
            `✅ ${result.inserted ?? leadsComTelefone.length} leads enviados para o LeadFlowAI!`, 'ok');
        } catch {
          setStatus('sendStatus', 'Erro de rede. Verifique a URL do Webhook.', 'err');
        }
      }
    );
  });

  /* Exportar CSV */
  document.getElementById('exportCsv').addEventListener('click', () => {
    chrome.storage.local.get(['cnpjSearches'], data => {
      const leads = _allLeads.length
        ? _allLeads
        : Object.values(data.cnpjSearches || {}).flatMap(s => s.leads || []);

      if (!leads.length) {
        setStatus('sendStatus', 'Nenhum lead para exportar.', 'err'); return;
      }

      const rows = [
        ['cnpj', 'name', 'phone', 'email', 'notes'],
        ...leads.map(l => [l.cnpj||'', l.name||'', l.phone||'', l.email||'', l.notes||''])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
      chrome.downloads.download({ url, filename: `cnpj-leads-${new Date().toISOString().slice(0, 10)}.csv`, saveAs: true }, () => {
        setStatus('sendStatus', `CSV exportado com ${leads.length} registros.`, 'ok');
      });
    });
  });

  document.querySelector('[data-section="capture"]').click();
});
