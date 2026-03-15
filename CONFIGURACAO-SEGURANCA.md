# O que fazer para funcionar após as correções de segurança

## 1. Criar a tabela de rate limit (obrigatório)

O login usa a tabela `login_attempts`. Crie ela no D1 com um dos jeitos abaixo.

### Opção A – Pelo terminal (recomendado)

Na pasta do projeto:

```bash
npx wrangler d1 execute bot_connect_crm --remote --file=./migrations/0002_login_attempts.sql
```

Para ambiente **local** (dev):

```bash
npx wrangler d1 execute bot_connect_crm --local --file=./migrations/0002_login_attempts.sql
```

### Opção B – Pelo painel Cloudflare

1. Acesse **Workers & Pages** → **D1** → banco **bot_connect_crm**.
2. Abra **Console** e rode:

```sql
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 2. Ajustar variáveis de segurança

### Desenvolvimento local

No `wrangler.toml` já existem valores que funcionam para dev:

- **JWT_SECRET** – gera o token de login.
- **ALLOWED_ORIGINS** – inclui `http://localhost:5173` e `http://127.0.0.1:5173`.

Se o front rodar em outra porta, adicione em `ALLOWED_ORIGINS`, separando por vírgula.

### Produção (deploy na Cloudflare)

1. **JWT_SECRET**  
   No painel: **Workers & Pages** → seu Worker → **Settings** → **Variables and Secrets** → **Add** → **Secret**  
   Nome: `JWT_SECRET`  
   Valor: uma chave longa e aleatória (ex.: gerada com `openssl rand -base64 32`).

2. **ALLOWED_ORIGINS**  
   Mesmo lugar, **Add** → **Variable** (não secret):  
   Nome: `ALLOWED_ORIGINS`  
   Valor: a URL do seu front (ex.: `https://seu-app.pages.dev` ou `https://app.seudominio.com`). Várias origens: separar por vírgula, sem espaços.

Assim o login e o CORS passam a funcionar em produção.

---

## 3. Testar

1. Subir o backend (ex.: `npm run dev` ou `npx wrangler dev`).
2. Abrir o front (ex.: `http://localhost:5173`).
3. Fazer login: deve retornar `token` e o front guarda em `localStorage` e envia no header `Authorization: Bearer <token>`.
4. Se der erro de CORS, conferir se a origem do navegador está em `ALLOWED_ORIGINS`.

---

## Resumo

| O quê              | Onde / Como |
|--------------------|-------------|
| Tabela rate limit  | Rodar a migration (passo 1) no D1 (local e/ou remote). |
| Dev funcionando    | Manter `JWT_SECRET` e `ALLOWED_ORIGINS` no `wrangler.toml` (já configurados para localhost). |
| Produção segura    | Definir `JWT_SECRET` e `ALLOWED_ORIGINS` como **Secrets/Variables** no painel e **não** commitar o JWT em código. |

Depois disso, o fluxo de login, token e CORS fica funcionando no dia a dia.
