/* ══════════════════════════════════════════════════════════
   Content Script — Extrator CNPJ (portal.casadosdados.com.br)
   Preenche filtros, clica Pesquisar, scrapa resultados, pagina.
   ══════════════════════════════════════════════════════════ */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Forçar valor em input Vue/Oruga ── */
function setNativeValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ||
                 Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ── Verificar se o usuário está logado ── */
function checkLogin() {
  // Presença de "Minhas Assinaturas" ou ausência do link "Login" indica autenticado
  const loginLink = document.querySelector('a[href="/entrar"]');
  const subsLink  = document.querySelector('a[href="/plataforma/minha-conta/assinatura"]');
  if (subsLink) return true;
  if (loginLink) return false;
  // fallback: se há menu de "Plataforma" está logado
  return !!document.querySelector('a[href="/plataforma"]');
}

/* ── Preenche e dispara a pesquisa ── */
async function fillAndSearch(filters) {
  const { uf, situacao, termo, comTelefone, comEmail, somenteMEI, excluirMEI, somenteMatriz } = filters;

  /* Aguarda a página estar pronta */
  await sleep(1500);

  /* ── Busca Textual (opcional) ── */
  if (termo) {
    const termoInputs = document.querySelectorAll('input[placeholder="Digite o texto e aperte enter"]');
    if (termoInputs.length) {
      const inp = termoInputs[0];
      inp.focus();
      setNativeValue(inp, termo);
      await sleep(300);
      inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
      inp.dispatchEvent(new KeyboardEvent('keyup',   { bubbles: true, key: 'Enter', keyCode: 13 }));
      await sleep(400);
    }
  }

  /* ── Situação Cadastral ── */
  if (situacao) {
    // Desmarca todas primeiro
    document.querySelectorAll('input[type="checkbox"][value="ativa"], input[type="checkbox"][value="baixada"], input[type="checkbox"][value="inapta"], input[type="checkbox"][value="nula"], input[type="checkbox"][value="suspensa"]')
      .forEach(cb => { if (cb.checked) cb.click(); });
    await sleep(200);
    // Marca a desejada
    const cb = document.querySelector(`input[type="checkbox"][value="${situacao}"]`);
    if (cb && !cb.checked) cb.click();
    await sleep(200);
  } else {
    // Marca "Ativa" por padrão se nada especificado
    const cb = document.querySelector('input[type="checkbox"][value="ativa"]');
    if (cb && !cb.checked) cb.click();
    await sleep(200);
  }

  /* ── Estado (UF) ── */
  if (uf) {
    // O campo de UF é um taginput com autocomplete
    const ufInput = document.querySelector('input[placeholder="Selecione o estado"]');
    if (ufInput) {
      ufInput.focus();
      setNativeValue(ufInput, uf);
      await sleep(600); // aguarda dropdown aparecer
      // Clica no primeiro item do dropdown que contenha a UF
      const dropdowns = document.querySelectorAll('.dropdown-content .dropdown-item');
      for (const item of dropdowns) {
        if (item.textContent.trim().startsWith(uf + ' -') || item.textContent.trim().startsWith(uf)) {
          item.click();
          await sleep(300);
          break;
        }
      }
    }
  }

  /* ── Switches (com telefone, com email, MEI, etc.) ── */
  // Ativa "Com contato de telefone"
  if (comTelefone) await toggleSwitch('Com contato de telefone', true);
  // Ativa "Com e-mail"
  if (comEmail)    await toggleSwitch('Com e-mail', true);
  // Somente MEI
  if (somenteMEI)  await toggleSwitch('Somente MEI', true);
  // Excluir MEI
  if (excluirMEI)  await toggleSwitch('Excluir MEI', true);
  // Somente matriz
  if (somenteMatriz) await toggleSwitch('Somente matriz', true);

  /* ── Limite por página (100) ── */
  const limitSelects = document.querySelectorAll('select');
  for (const sel of limitSelects) {
    const options = Array.from(sel.options).map(o => o.value);
    if (options.includes('100')) {
      setNativeValue(sel, '100');
      break;
    }
  }

  await sleep(400);

  /* ── Clica em Pesquisar ── */
  const buttons = Array.from(document.querySelectorAll('a.button, button.button'));
  const searchBtn = buttons.find(b => b.textContent.trim().toLowerCase().includes('pesquisar'));
  if (!searchBtn) return { ok: false, error: 'Botão Pesquisar não encontrado.' };
  searchBtn.click();

  return { ok: true };
}

async function toggleSwitch(labelText, enable) {
  // Procura label de switch que contenha o texto
  const labels = Array.from(document.querySelectorAll('label.control-label'));
  for (const label of labels) {
    if (label.textContent.trim().toLowerCase().includes(labelText.toLowerCase())) {
      const input = document.getElementById(label.getAttribute('for'));
      if (!input) break;
      const isChecked = input.getAttribute('aria-checked') === 'true' || input.checked;
      if (enable && !isChecked)  { input.click(); await sleep(200); }
      if (!enable && isChecked)  { input.click(); await sleep(200); }
      break;
    }
  }
}

/* ── Aguarda resultados aparecerem ── */
async function waitForResults(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = scrapeResults();
    if (rows.length > 0) return true;
    await sleep(500);
  }
  return false; // timeout
}

/* ── Scrapa resultados da página atual ── */
function scrapeResults() {
  const leads = [];

  /* Tenta tabela */
  const rows = document.querySelectorAll('table tbody tr');
  if (rows.length > 0) {
    rows.forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td'));
      if (cells.length < 2) return;
      const texts = cells.map(c => c.textContent.trim());
      const lead = extractLeadFromCells(texts, tr);
      if (lead) leads.push(lead);
    });
    return leads;
  }

  /* Tenta cards (.box, .card) */
  const cards = document.querySelectorAll('.box, .card');
  cards.forEach(card => {
    const text = card.textContent;
    const cnpjMatch = text.match(/\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/\.\-]?\d{4}[\-\.]?\d{2}/);
    if (!cnpjMatch) return;
    const phone = extractPhone(text);
    const name  = extractName(card);
    leads.push({ name, phone, cnpj: cnpjMatch[0].replace(/\D/g, ''), email: extractEmail(text), notes: extractNotes(text) });
  });

  return leads;
}

function extractLeadFromCells(texts, tr) {
  let name  = '';
  let cnpj  = '';
  let phone = '';
  let email = '';
  let uf    = '';
  let municipio = '';
  let situacao  = '';

  for (const text of texts) {
    const t = text.trim();
    if (!cnpj  && /^\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/\.\-]?\d{4}[\-\.]?\d{2}$/.test(t.replace(/\s/g, ''))) {
      cnpj = t.replace(/\D/g, ''); continue;
    }
    if (!phone && /^[\(\d][\d\s\(\)\-\.]{7,14}$/.test(t) && /\d{8,}/.test(t.replace(/\D/g, ''))) {
      phone = t.replace(/\D/g, ''); continue;
    }
    if (!email && /\S+@\S+\.\S+/.test(t)) {
      email = t.toLowerCase(); continue;
    }
    if (!uf && /^[A-Z]{2}$/.test(t) && ['SP','RJ','MG','RS','PR','SC','BA','GO','DF','PE','CE','PA','MA','ES','RO','AM','TO','RN','AL','PB','AC','AP','RR','MS','MT','SE','PI'].includes(t)) {
      uf = t; continue;
    }
    if (!situacao && ['ativa','baixada','inapta','nula','suspensa','cancelada'].includes(t.toLowerCase())) {
      situacao = t; continue;
    }
    // Primeira string longa sem CNPJ/phone é o nome
    if (!name && t.length > 3 && !/^\d/.test(t)) {
      name = t;
    }
  }

  // Tenta extrair telefone de link tel:
  const telLink = tr.querySelector('a[href^="tel:"]');
  if (telLink && !phone) phone = telLink.getAttribute('href').replace('tel:', '').replace(/\D/g, '');

  if (!name && !cnpj && !phone) return null;
  const notes = [situacao, municipio, uf].filter(Boolean).join(' - ');
  return { name, phone, cnpj, email, notes };
}

function extractPhone(text) {
  const m = text.match(/\(?\d{2}\)?\s*\d{4,5}[\-\s]?\d{4}/);
  return m ? m[0].replace(/\D/g, '') : '';
}

function extractEmail(text) {
  const m = text.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/);
  return m ? m[0].toLowerCase() : '';
}

function extractName(card) {
  // Tenta h1/h2/h3/strong/b dentro do card
  for (const sel of ['h1','h2','h3','strong','b','.title','.subtitle']) {
    const el = card.querySelector(sel);
    if (el && el.textContent.trim().length > 2) return el.textContent.trim();
  }
  return '';
}

function extractNotes(text) {
  const cnae = text.match(/CNAE[:\s]+[\d\.\-\/]+([\w\s]+)?/i);
  return cnae ? cnae[0].slice(0, 100) : '';
}

/* ── Conta total de resultados e páginas ── */
function getPageInfo() {
  // Tenta encontrar texto como "X resultados encontrados" ou paginação
  const allText = document.body.innerText;

  // Total de registros
  const totalMatch = allText.match(/(\d[\d\.]*)\s*(empresa[s]?|registro[s]?|resultado[s]?)\s*(encontrado[s]?|disponível[s]?)?/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/\D/g, ''), 10) : null;

  // Paginação
  const pagination = document.querySelector('[data-oruga="pagination"], .pagination, nav[role="navigation"]');
  const currentPage = pagination ? getCurrentPage(pagination) : 1;
  const hasNextPage = !!getNextPageButton();

  return { total, currentPage, hasNextPage };
}

function getCurrentPage(paginationEl) {
  const active = paginationEl?.querySelector('[aria-current="page"], .is-current, .pagination-link.is-current');
  if (active) return parseInt(active.textContent.trim(), 10) || 1;
  return 1;
}

function getNextPageButton() {
  // Oruga pagination
  const buttons = Array.from(document.querySelectorAll('button, a'));
  return buttons.find(b => {
    const label = b.getAttribute('aria-label') || b.textContent.trim();
    return /next|próxim|seguinte|>/.test(label.toLowerCase()) && !b.disabled && !b.classList.contains('is-disabled');
  }) || null;
}

/* ── Vai para próxima página ── */
async function goNextPage() {
  const btn = getNextPageButton();
  if (!btn) return { ok: false, hasMore: false };
  btn.click();
  await sleep(2000);
  const appeared = await waitForResults(8000);
  return { ok: appeared, hasMore: !!getNextPageButton() };
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens do dashboard
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'CDADOS_CHECK_LOGIN') {
    sendResponse({ ok: true, loggedIn: checkLogin() });
    return true;
  }

  if (message.type === 'CDADOS_FILL_AND_SEARCH') {
    fillAndSearch(message.filters).then(result => sendResponse(result));
    return true;
  }

  if (message.type === 'CDADOS_WAIT_RESULTS') {
    waitForResults(message.timeout || 15000).then(found => {
      const results = found ? scrapeResults() : [];
      const pageInfo = getPageInfo();
      sendResponse({ ok: found, results, pageInfo });
    });
    return true;
  }

  if (message.type === 'CDADOS_SCRAPE') {
    const results = scrapeResults();
    const pageInfo = getPageInfo();
    sendResponse({ ok: true, results, pageInfo });
    return true;
  }

  if (message.type === 'CDADOS_NEXT_PAGE') {
    goNextPage().then(result => {
      const results = scrapeResults();
      sendResponse({ ...result, results });
    });
    return true;
  }
});
