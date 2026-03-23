/* ══════════════════════════════════════════════════════════
   Content Script — Extrator CNPJ (portal.casadosdados.com.br)

   Fase 1 — Preenche filtros, clica Pesquisar, coleta a lista
            de CNPJs/links paginando até o limite pedido.
   Fase 2 — Entra em cada página de empresa e extrai telefone,
            e-mail, WhatsApp, endereço.
   ══════════════════════════════════════════════════════════ */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Simula clique real (para Vue/Nuxt) ── */
function simulateClick(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true, view: window }));
}

/* ── Força valor em input Vue (setter nativo para o reativo detectar) ── */
function setNativeValue(el, value) {
  const proto  = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ── Verifica login ── */
function checkLogin() {
  const subsLink  = document.querySelector('a[href*="minha-conta"], a[href*="assinatura"]');
  const loginLink = document.querySelector('a[href="/entrar"]');
  if (subsLink)  return true;
  if (loginLink) return false;
  return !!document.querySelector('.navbar-item[href="/plataforma"]');
}

/* ═══════════════════════════════════════════════════════
   FASE 1 — Preenche formulário e coleta links
   ═══════════════════════════════════════════════════════ */

/* ── Seleciona item de taginput/autocomplete ── */
async function selectTagInputOption(placeholder, value) {
  const input = document.querySelector(`input[placeholder="${placeholder}"]`);
  if (!input) return false;

  input.focus();
  setNativeValue(input, value);
  await sleep(700);

  // Espera dropdown aparecer
  const dropdowns = document.querySelectorAll('.dropdown-item[role="option"]');
  for (const item of dropdowns) {
    const txt = item.textContent.trim();
    if (txt.startsWith(value + ' -') || txt.startsWith(value + ' ') || txt === value || txt.toUpperCase().startsWith(value.toUpperCase())) {
      simulateClick(item);
      await sleep(400);
      return true;
    }
  }
  // Tenta pressionar Enter para confirmar
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
  await sleep(300);
  return false;
}

async function fillAndSearch(filters) {
  const { uf, situacao, termo, comTelefone, comEmail, somenteMEI, excluirMEI, somenteMatriz } = filters;

  await sleep(2000); // aguarda hidratação Nuxt

  /* ── Busca Textual ── */
  if (termo) {
    const inputs = document.querySelectorAll('input[placeholder*="texto"][placeholder*="enter"], input[placeholder*="Digite"]');
    if (inputs.length) {
      const inp = inputs[0];
      inp.focus();
      setNativeValue(inp, termo);
      await sleep(400);
      inp.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13, which: 13 }));
      await sleep(500);
    }
  }

  /* ── Situação Cadastral ── */
  // Desmarca todas
  ['ativa','baixada','inapta','nula','suspensa'].forEach(v => {
    const cb = document.querySelector(`input[type="checkbox"][value="${v}"]`);
    if (cb?.checked) simulateClick(cb);
  });
  await sleep(200);
  // Marca a desejada (ou "ativa" por padrão)
  const sitValue = situacao || 'ativa';
  const sitCb = document.querySelector(`input[type="checkbox"][value="${sitValue}"]`);
  if (sitCb && !sitCb.checked) simulateClick(sitCb);
  await sleep(200);

  /* ── Estado (UF) ── */
  if (uf) {
    await selectTagInputOption('Selecione o estado', uf);
  }

  /* ── Switches ── */
  if (comTelefone)   await toggleSwitch('telefone',  true);
  if (comEmail)      await toggleSwitch('e-mail',    true);
  if (somenteMEI)    await toggleSwitch('Somente MEI', true);
  if (excluirMEI)    await toggleSwitch('Excluir MEI', true);
  if (somenteMatriz) await toggleSwitch('matriz',    true);

  /* ── Limite por página → 100 ── */
  const selects = document.querySelectorAll('select');
  for (const sel of selects) {
    if (Array.from(sel.options).some(o => o.value === '100')) {
      setNativeValue(sel, '100');
      break;
    }
  }
  await sleep(300);

  /* ── Clica em Pesquisar ── */
  // Tenta múltiplas estratégias
  let clicked = false;

  // Estratégia 1: <a> com texto "Pesquisar"
  const allLinks = Array.from(document.querySelectorAll('a.button'));
  const pesquisarLink = allLinks.find(a => a.textContent.trim().toLowerCase() === 'pesquisar');
  if (pesquisarLink) { simulateClick(pesquisarLink); clicked = true; }

  // Estratégia 2: qualquer elemento com texto Pesquisar e classe button
  if (!clicked) {
    const all = Array.from(document.querySelectorAll('.button, button, a'));
    const btn = all.find(el => el.textContent.trim().toLowerCase() === 'pesquisar');
    if (btn) { simulateClick(btn); clicked = true; }
  }

  if (!clicked) return { ok: false, error: 'Botão Pesquisar não encontrado na página.' };

  return { ok: true };
}

async function toggleSwitch(labelKeyword, enable) {
  const labels = Array.from(document.querySelectorAll('label.control-label'));
  for (const label of labels) {
    if (label.textContent.toLowerCase().includes(labelKeyword.toLowerCase())) {
      const input = document.getElementById(label.getAttribute('for'));
      if (!input) continue;
      const isChecked = input.getAttribute('aria-checked') === 'true' || input.checked;
      if (enable !== isChecked) { simulateClick(input); await sleep(200); }
      break;
    }
  }
}

/* ── Aguarda resultados aparecerem na página ── */
async function waitForResults(timeoutMs = 18000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getResultEntries().length > 0) return true;
    await sleep(600);
  }
  return false;
}

/* ── Coleta entradas de resultado (CNPJ + nome + link) ── */
function getResultEntries() {
  const entries = [];

  // Padrão 1: links com CNPJ no href — /empresa/CNPJ ou similar
  const companyLinks = document.querySelectorAll('a[href*="/empresa/"]');
  companyLinks.forEach(a => {
    const href = a.getAttribute('href') || '';
    const cnpjMatch = href.match(/(\d{14})/);
    if (cnpjMatch) {
      const cnpj = cnpjMatch[1];
      const url  = href.startsWith('http') ? href : `https://portal.casadosdados.com.br${href}`;
      entries.push({ cnpj, name: a.textContent.trim() || '', url });
    }
  });
  if (entries.length > 0) return entries;

  // Padrão 2: tabela ou lista — procura linhas com padrão de CNPJ
  const rows = document.querySelectorAll('table tbody tr, .result-item, .columns.is-mobile, .box');
  rows.forEach(row => {
    const text = row.textContent;
    const cnpjMatch = text.match(/(\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\/\.\-]?\d{4}[\-\.]?\d{2})/);
    if (!cnpjMatch) return;
    const cnpj = cnpjMatch[1].replace(/\D/g, '');

    // Link dentro da linha
    const link = row.querySelector('a[href]');
    const href = link?.getAttribute('href') || '';
    const url  = href
      ? (href.startsWith('http') ? href : `https://portal.casadosdados.com.br${href}`)
      : `https://portal.casadosdados.com.br/empresa/${cnpj}`;

    // Nome da empresa: primeiro texto longo que não seja CNPJ/status
    const cells = Array.from(row.querySelectorAll('td, .column'));
    let name = '';
    for (const c of cells) {
      const t = c.textContent.trim();
      if (t.length > 5 && !/^\d{2}[\.\-]/.test(t) && !['ativa','baixada','inapta','nula','suspensa'].includes(t.toLowerCase())) {
        name = t; break;
      }
    }
    if (!name) {
      // Tenta extrair nome do texto geral depois do CNPJ
      const afterCnpj = text.replace(cnpjMatch[1], '').trim();
      name = afterCnpj.split('\n')[0].trim().slice(0, 80);
    }

    entries.push({ cnpj, name, url });
  });
  if (entries.length > 0) return entries;

  // Padrão 3: texto puro com padrão "XX.XXX.XXX/XXXX-XX - NOME"
  const bodyText = document.body.innerHTML;
  const regex = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s*[-–]\s*([A-ZÁÀÃÉÊÓÔÇÕÜ][^\n<]{3,80})/g;
  let m;
  while ((m = regex.exec(bodyText)) !== null) {
    const cnpj = m[1].replace(/\D/g, '');
    const name = m[2].trim();
    if (!entries.find(e => e.cnpj === cnpj)) {
      entries.push({ cnpj, name, url: `https://portal.casadosdados.com.br/empresa/${cnpj}` });
    }
  }

  return entries;
}

/* ── Info de paginação ── */
function getPageInfo() {
  // Total de resultados
  const bodyText = document.body.innerText;
  const totalMatch = bodyText.match(/(\d[\d\.,]*)\s*resultado[s]?/i) ||
                     bodyText.match(/Encontrado[s]?\s+(\d[\d\.,]*)/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/[^\d]/g, ''), 10) : null;

  const hasNext = !!getNextPageButton();
  return { total, hasNext };
}

function getNextPageButton() {
  const pagination = document.querySelector('[data-oruga="pagination"], .pagination');
  if (!pagination) return null;
  const btns = Array.from(pagination.querySelectorAll('a, button'));
  return btns.find(b => {
    if (b.disabled || b.classList.contains('is-disabled') || b.getAttribute('aria-disabled') === 'true') return false;
    const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
    return label.includes('próxim') || label.includes('next') || label === '>' || label === '»';
  }) || null;
}

async function goNextPage() {
  const btn = getNextPageButton();
  if (!btn) return { ok: false };
  simulateClick(btn);
  await sleep(2500);
  const found = await waitForResults(10000);
  return { ok: found, hasNext: !!getNextPageButton() };
}

/* ═══════════════════════════════════════════════════════
   FASE 2 — Extrai detalhes de uma página de empresa
   ═══════════════════════════════════════════════════════ */
function extractCompanyDetails() {
  const text = document.body.innerText;
  const html = document.body.innerHTML;

  /* ── Telefone / WhatsApp ── */
  let phone = '';

  // Link tel: ou wa.me
  const telLink = document.querySelector('a[href^="tel:"]');
  if (telLink) phone = telLink.getAttribute('href').replace('tel:', '').replace(/\D/g, '');

  const waLink = document.querySelector('a[href*="wa.me/"], a[href*="api.whatsapp.com/send"]');
  if (waLink && !phone) {
    const waHref = waLink.getAttribute('href');
    const waMatch = waHref.match(/(\d{10,13})/);
    if (waMatch) phone = waMatch[1];
  }

  // Padrão em texto: (DDD) NNNNN-NNNN
  if (!phone) {
    const phoneMatch = text.match(/\((\d{2})\)\s*(\d{4,5})[-\s]?(\d{4})/);
    if (phoneMatch) phone = phoneMatch[1] + phoneMatch[2] + phoneMatch[3];
  }

  // Padrão compacto: 11 dígitos começando com DDD
  if (!phone) {
    const raw = text.match(/\b(\d{10,11})\b/);
    if (raw) phone = raw[1];
  }

  /* ── E-mail ── */
  const emailMatch = text.match(/[\w.\-+]+@[\w.\-]+\.\w{2,}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : '';

  /* ── Nome da empresa ── */
  const h1 = document.querySelector('h1, h2, .title');
  const name = h1 ? h1.textContent.trim() : '';

  /* ── Endereço / CEP ── */
  const cepMatch  = text.match(/\d{5}-\d{3}/);
  const cep = cepMatch ? cepMatch[0] : '';

  /* ── CNAE ── */
  const cnaeMatch = text.match(/CNAE[:\s]+([^\n]{5,60})/i);
  const cnae = cnaeMatch ? cnaeMatch[1].trim().slice(0, 80) : '';

  /* ── Situação ── */
  const sitMatch = text.match(/\b(Ativa|Baixada|Inapta|Nula|Suspensa)\b/i);
  const situacao = sitMatch ? sitMatch[1] : '';

  /* ── Monta notes ── */
  const notes = [cnae, cep ? `CEP: ${cep}` : '', situacao].filter(Boolean).join(' | ');

  return { phone, email, name, notes };
}

/* ══════════════════════════════════════════════════════════
   Listener de mensagens
   ══════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'CDADOS_CHECK_LOGIN') {
    sendResponse({ ok: true, loggedIn: checkLogin() });
    return true;
  }

  if (message.type === 'CDADOS_FILL_AND_SEARCH') {
    fillAndSearch(message.filters).then(r => sendResponse(r));
    return true;
  }

  if (message.type === 'CDADOS_WAIT_RESULTS') {
    waitForResults(message.timeout || 18000).then(found => {
      const entries = found ? getResultEntries() : [];
      const pageInfo = getPageInfo();
      sendResponse({ ok: found, entries, pageInfo });
    });
    return true;
  }

  if (message.type === 'CDADOS_SCRAPE') {
    const entries = getResultEntries();
    const pageInfo = getPageInfo();
    sendResponse({ ok: true, entries, pageInfo });
    return true;
  }

  if (message.type === 'CDADOS_NEXT_PAGE') {
    goNextPage().then(r => {
      const entries = getResultEntries();
      sendResponse({ ...r, entries });
    });
    return true;
  }

  if (message.type === 'CDADOS_EXTRACT_DETAILS') {
    const details = extractCompanyDetails();
    sendResponse({ ok: true, ...details });
    return true;
  }

});
