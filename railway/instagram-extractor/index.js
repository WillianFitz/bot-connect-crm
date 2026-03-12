import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Sessões em memória por tenant (enquanto o container estiver rodando)
const sessions = new Map();

async function createBrowser() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return browser;
}

function getSession(tenantId) {
  return sessions.get(tenantId);
}

function setSession(tenantId, value) {
  sessions.set(tenantId, value);
}

async function clearSession(tenantId) {
  const current = sessions.get(tenantId);
  if (current?.browser) {
    try {
      await current.browser.close();
    } catch (e) {
      console.error("Erro ao fechar browser:", e);
    }
  }
  sessions.delete(tenantId);
}

app.post("/api/instagram/login/start", async (req, res) => {
  const { tenantId, credentials } = req.body || {};

  if (!tenantId || !credentials?.username || !credentials?.password) {
    return res
      .status(400)
      .json({ error: "tenantId, username e password são obrigatórios" });
  }

  console.log("Iniciando login Instagram para tenant:", tenantId);

  await clearSession(tenantId);

  try {
    const browser = await createBrowser();
    const page = await browser.newPage();

    // Deixa o User-Agent mais "real" e aumenta timeout geral
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Vários seletores possíveis para o campo de usuário
    const usernameSelectors = [
      'input[name="username"]',
      'input[aria-label="Phone number, username, or email"]',
      'input[aria-label="Phone number, username, or email address"]',
    ];

    let usernameSelector = null;
    for (const sel of usernameSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 15000 });
        usernameSelector = sel;
        break;
      } catch {
        // tenta o próximo
      }
    }

    if (!usernameSelector) {
      throw new Error(
        "Não foi possível localizar o campo de usuário na tela de login do Instagram (página pode não ter carregado ou estar bloqueada)."
      );
    }

    await page.type(usernameSelector, credentials.username, {
      delay: 50,
    });
    await page.type('input[name="password"]', credentials.password, {
      delay: 50,
    });

    // Campo de senha (mantemos o seletor padrão)
    await page.waitForSelector('input[name="password"]', { timeout: 30000 });

    await page.type('input[name="password"]', credentials.password, {
      delay: 50,
    });

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForTimeout(7000),
    ]);

    const currentUrl = page.url();

    // Heurística simples para saber se pediu desafio/2FA
    const isChallenge = currentUrl.includes("/challenge");

    if (isChallenge) {
      setSession(tenantId, { browser, page, status: "2fa_pending" });
      console.log("2FA requerido para tenant:", tenantId);
      return res.json({
        status: "2fa_required",
        message: "Digite o código enviado pelo Instagram.",
      });
    }

    // Se não caiu em /challenge, consideramos logado
    setSession(tenantId, { browser, page, status: "logged" });
    console.log("Login concluído sem 2FA para tenant:", tenantId);

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro no login do Instagram:", err);
    await clearSession(tenantId);
    return res
      .status(500)
      .json({ error: "Falha ao fazer login no Instagram", details: String(err) });
  }
});

app.post("/api/instagram/login/verify", async (req, res) => {
  const { tenantId, code } = req.body || {};

  if (!tenantId || !code) {
    return res
      .status(400)
      .json({ error: "tenantId e code são obrigatórios" });
  }

  const session = getSession(tenantId);
  if (!session || session.status !== "2fa_pending") {
    return res
      .status(400)
      .json({ error: "Nenhum login pendente de 2FA para este tenant." });
  }

  const { page, browser } = session;

  try {
    // Heurísticas de campo de código (pode variar conforme o Instagram)
    const selectorCandidates = [
      'input[name="verificationCode"]',
      'input[name="security_code"]',
      'input[type="text"]',
    ];

    let usedSelector = null;
    for (const sel of selectorCandidates) {
      const exists = await page.$(sel);
      if (exists) {
        usedSelector = sel;
        break;
      }
    }

    if (!usedSelector) {
      return res.status(500).json({
        error:
          "Não foi possível localizar o campo de código 2FA na tela de desafio do Instagram.",
      });
    }

    await page.type(usedSelector, String(code), { delay: 50 });

    // Tenta encontrar um botão de confirmação/enviar
    const buttonCandidates = [
      'button[type="button"]',
      'button[type="submit"]',
      "button",
    ];

    let clicked = false;
    for (const b of buttonCandidates) {
      const exists = await page.$(b);
      if (exists) {
        await Promise.all([page.click(b), page.waitForTimeout(5000)]);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      return res.status(500).json({
        error: "Não foi possível encontrar o botão para confirmar o código 2FA.",
      });
    }

    const currentUrl = page.url();
    const stillChallenge = currentUrl.includes("/challenge");

    if (stillChallenge) {
      return res.status(400).json({
        error: "Código 2FA inválido ou não aceito pelo Instagram.",
      });
    }

    // Consideramos logado
    setSession(tenantId, { browser, page, status: "logged" });
    console.log("2FA concluído com sucesso para tenant:", tenantId);

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao validar 2FA do Instagram:", err);
    await clearSession(tenantId);
    return res.status(500).json({
      error: "Falha ao validar o código 2FA no Instagram",
      details: String(err),
    });
  }
});

app.post("/api/instagram/start", async (req, res) => {
  const { jobId, tenantId, profile, callbackUrl } = req.body || {};

  if (!jobId || !tenantId || !profile || !callbackUrl) {
    return res
      .status(400)
      .json({ error: "jobId, tenantId, profile e callbackUrl são obrigatórios" });
  }

  const session = getSession(tenantId);
  if (!session || session.status !== "logged") {
    return res.status(400).json({
      error:
        "Sessão do Instagram não encontrada. Faça o login (e 2FA, se necessário) antes de iniciar a extração.",
    });
  }

  console.log("Novo job Instagram:", {
    jobId,
    tenantId,
    profile,
    callbackUrl,
  });

  // Aqui, em uma implementação real, você usaria a sessão logada
  // para abrir o perfil e percorrer a lista de seguidores.
  // Por enquanto, mantemos leads fake, mas somente se estiver logado.

  try {
    setTimeout(async () => {
      const fakeLeads = [
        { company: `${profile}-seguidor-1`, phone: "5511999999999" },
        { company: `${profile}-seguidor-2`, phone: "5511988888888" },
      ];

      await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          tenantId,
          leads: fakeLeads,
          done: true,
        }),
      });

      console.log("Leads enviados ao Worker com sucesso");
    }, 3000);

    return res.json({ ok: true, started: true });
  } catch (err) {
    console.error("Erro no extrator:", err);

    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          tenantId,
          leads: [],
          done: true,
          error: String(err?.message || err),
        }),
      });
    } catch (e) {
      console.error("Falha ao notificar Worker do erro:", e);
    }

    return res.status(500).json({ error: "Erro ao iniciar extração" });
  }
});

app.listen(PORT, () => {
  console.log(`Instagram extractor ouvindo em http://0.0.0.0:${PORT}`);
});

