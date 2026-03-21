# CLAUDE.md — bot-connect-crm

Este arquivo orienta o Claude Code sobre a arquitetura, convenções e fluxo de trabalho do projeto.

---

## Visão Geral do Projeto

**LeadFlowAI** é um CRM SaaS multi-tenant com extração de leads, automação via bot e integração com redes sociais e ferramentas externas.

**Deploy:**
- **Frontend:** Cloudflare Pages (não Railway — Railway não é usado para o frontend)
- **Backend/API:** Cloudflare Workers (`src/worker.ts`) com banco D1
- **Push para `main`** → deploy automático via Cloudflare Pages

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI Components | shadcn/ui + Tailwind CSS |
| Banco de dados | Cloudflare D1 (SQLite distribuído) |
| Backend/Edge | Cloudflare Workers (wrangler) |
| Deploy | Cloudflare Pages (frontend) + Cloudflare Workers (API) |
| Testes | Vitest + Playwright |
| Extensões | Chrome Extension Manifest V3 (Instagram, Google Maps, WhatsApp) |

---

## Estrutura de Pastas

```
bot-connect-crm/
├── src/
│   ├── App.tsx                 # Componente raiz + definição de rotas
│   ├── main.tsx                # Entry point React
│   ├── worker.ts               # Cloudflare Worker (API edge) — backend principal
│   ├── App.css / index.css     # Estilos globais
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx       # Visão geral / métricas
│   │   ├── Leads.tsx           # Gestão de leads extraídos
│   │   ├── Funnels.tsx         # Funis de vendas
│   │   ├── Campaigns.tsx       # Campanhas de disparo via bot
│   │   ├── Agents.tsx          # Agentes / atendentes
│   │   ├── Appointments.tsx    # Agendamentos
│   │   ├── Connections.tsx     # Conexões (WhatsApp, Instagram, etc.)
│   │   ├── Tools.tsx           # Ferramentas / integrações (extensões Chrome)
│   │   ├── Settings.tsx        # Configurações do sistema
│   │   ├── Admin.tsx           # Painel administrativo
│   │   ├── AdminLogin.tsx      # Login de administrador
│   │   ├── ClientLogin.tsx     # Login de cliente
│   │   └── NotFound.tsx        # Página 404
│   │
│   ├── components/
│   │   ├── AppLayout.tsx       # Layout principal (wrapper com sidebar)
│   │   ├── AppSidebar.tsx      # Menu lateral de navegação
│   │   ├── NavLink.tsx         # Link de navegação com estado ativo
│   │   ├── StatCard.tsx        # Card de estatística para o Dashboard
│   │   └── ui/                 # Componentes shadcn/ui (NÃO editar diretamente)
│   │
│   ├── lib/
│   │   ├── api.ts              # Funções de chamada à API (worker.ts)
│   │   └── utils.ts            # Utilitários gerais (cn, formatters, etc.)
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx      # Hook para detecção de mobile
│   │   └── use-toast.ts        # Hook de notificações toast
│   │
│   ├── types/
│   │   └── index.ts            # Tipos TypeScript compartilhados
│   │
│   ├── data/
│   │   └── mock.ts             # Dados mock para desenvolvimento
│   │
│   └── test/
│       ├── example.test.ts
│       └── setup.ts
│
├── extension/                  # Extensões Chrome (Manifest V3)
│   ├── instagram/              # Extrator de seguidores do Instagram
│   ├── gmaps/                  # Extrator de empresas do Google Maps
│   └── whatsapp/               # Extrator de participantes de grupos WhatsApp
│
├── migrations/                 # Migrations do banco D1 (SQL incremental)
├── public/
│   └── extensions/             # Extensões copiadas para download (via copy-extension.cjs)
│       ├── instagram/
│       ├── gmaps/
│       └── whatsapp/
├── scripts/
│   ├── copy-extension.cjs      # Copia extensões de extension/ para public/extensions/
│   └── generate-icons.cjs      # Gera ícones PNG 16/48/128px para as extensões
├── .wrangler/                  # Estado local do Cloudflare Workers (não editar)
├── schema.sql                  # Schema principal do banco de dados
├── wrangler.toml               # Configuração do Cloudflare Workers/D1
├── vite.config.ts
├── tailwind.config.ts
└── components.json             # Configuração do shadcn/ui
```

---

## Banco de Dados

- **Cloudflare D1** (SQLite na edge) — definido em `wrangler.toml`
- Schema em `schema.sql`
- Migrations incrementais em `migrations/`
- Para aplicar migrations localmente: `wrangler d1 migrations apply <DB_NAME> --local`
- Para produção: `wrangler d1 migrations apply <DB_NAME> --remote`
- **Migration recente:** `migrations/0019_leads_gmaps_fields.sql` — adicionou colunas `website` e `notes` na tabela `leads`

---

## Comandos Principais

```bash
npm run dev                      # Inicia servidor de desenvolvimento (Vite)
npm run build                    # Build de produção
node scripts/copy-extension.cjs  # Copia extensões para public/extensions/
node scripts/generate-icons.cjs  # Gera ícones PNG para as extensões
wrangler deploy                  # Deploy do Worker para Cloudflare
```

---

## Extensões Chrome

Todas as extensões seguem **Manifest V3** e têm a mesma estrutura visual (dashboard dark theme com variáveis CSS compartilhadas, tema verde `#22c55e`).

### Fluxo de geração/download das extensões

1. O painel (`Tools.tsx`) chama o endpoint `/api/tools/<tipo>/config` (GET) para buscar o token
2. Gera um ZIP com JSZip incluindo todos os arquivos da extensão + um `config.json` com `tenantId`, `extensionToken` e `webhookUrl` já preenchidos
3. O usuário baixa, descompacta e carrega no Chrome (modo desenvolvedor)

### Endpoints de API das extensões (em `src/worker.ts`, função `handleInstagramTools`)

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/tools/instagram/config` | GET/PUT | Token da extensão Instagram |
| `/api/tools/instagram/push-leads` | POST | Recebe leads da extensão Instagram |
| `/api/tools/gmaps/config` | GET/PUT | Token da extensão Google Maps |
| `/api/tools/gmaps/push-leads` | POST | Recebe leads da extensão Google Maps |
| `/api/tools/whatsapp/config` | GET/PUT | Token da extensão WhatsApp |
| `/api/tools/whatsapp/push-leads` | POST | Recebe leads da extensão WhatsApp |

**Roteamento** (em `src/worker.ts`): `pathname.startsWith("/api/tools/instagram") || pathname.startsWith("/api/tools/gmaps") || pathname.startsWith("/api/tools/whatsapp")` → `handleInstagramTools()`

**CORS:** `chrome-extension://` e `moz-extension://` são permitidas para os endpoints `push-leads` (necessário para as extensões enviarem leads).

**Token gerado com:** `crypto.getRandomValues()` (NÃO usar `crypto.randomUUID()` — não disponível em todos os contextos do Worker).

### Tabela de suporte no banco

Tokens ficam em `tools_extractors` (colunas: `tenant_id`, `type`, `config_json`). Tipos: `'instagram'`, `'gmaps'`, `'whatsapp'`.

### extension/instagram/

- **Fase 1:** coleta usernames dos seguidores de um perfil
- **Fase 2:** varre a bio de cada username buscando telefone
- Abre uma janela minimizada do Chrome (`chrome.windows.create` → `chrome.windows.update({ state: "minimized" })`)
- Tem botão **⏹ Parar** que interrompe após o perfil atual
- Campo **Pasta no LeadFlowAI** (enviado no payload como `folder`)
- Terminologia: "Extração" (não "Captura"), menu com ícone 🔍

### extension/gmaps/

- Abre o Google Maps em janela minimizada, rola os resultados, entra em cada empresa
- Extrai: nome, telefone, site, categoria, endereço
- `waitTabComplete` tem timeout de 12 segundos (evita travar se a página não carregar)
- Tem botão **⏹ Parar**
- Campo **Pasta no LeadFlowAI** + **Termo de busca**

### extension/whatsapp/

- Content script injetado em `web.whatsapp.com`
- Usuário abre o grupo → clica no nome (abre painel de info com participantes) → clica em Extrair no dashboard
- O dashboard encontra a aba do WhatsApp Web aberta (`chrome.tabs.query`) e envia mensagem `EXTRACT_PARTICIPANTS`
- Content script faz scroll no painel de info, extrai `[data-testid="cell-frame-container"]`
- Normaliza telefones para formato E.164 (prefixo +55 para números brasileiros)
- Campo **Pasta no LeadFlowAI**

### Ícones das extensões

Gerados por `scripts/generate-icons.cjs` — PNG 16/48/128px com gradiente `hsl(192,91%,52%) → hsl(265,80%,60%)` e raio com ícone de raio. **Não são SVG** (Chrome não aceita SVG em manifesto).

### Logo nas extensões

Usar `div` com `background: linear-gradient(135deg, hsl(192,91%,52%), hsl(265,80%,60%))` contendo SVG com `fill="hsl(222,47%,6%)"`. **NÃO usar** `fill="url(#id)"` com `linearGradient` — é bloqueado pela CSP das extensões Chrome.

### Depois de modificar extensões

```bash
node scripts/copy-extension.cjs   # Copia para public/extensions/
npm run build                      # Rebuild do frontend
git add ... && git commit && git push
```

---

## src/pages/Tools.tsx

Contém as 3 abas de extratores:
- **Extrator Instagram** — download da extensão + campos de ID/Token/Webhook + histórico de jobs
- **Extrator Google Maps** — download + campos + guia de uso
- **Extrator WhatsApp** — download + campos + guia de uso

Cada aba usa `useQuery` para buscar o config (token) do respectivo endpoint. O botão de download só ativa quando o token está disponível.

Funções de download: `handleDownloadExtension` (Instagram), `handleDownloadGmapsExtension` (Maps), `handleDownloadWhatsappExtension` (WhatsApp) — todas usam JSZip para gerar o ZIP com `config.json` pré-preenchido.

---

## Convenções de Código

- **TypeScript** em todo o projeto — sem `any` sem justificativa
- Componentes React: **PascalCase**, um componente por arquivo
- Componentes UI: usar **shadcn/ui** antes de criar custom
- Estilização: **Tailwind CSS** — evitar CSS inline ou `.css` separados
- Funções utilitárias: `src/lib/`
- Tipos compartilhados: `src/types/`

---

## Variáveis de Ambiente

Referência em `.env.production`. Para desenvolvimento local, criar `.env.local` (não commitado).

- `VITE_API_URL` — URL da API/Worker
- Credenciais D1 e bindings Cloudflare (definidos no `wrangler.toml`)

---

## Fluxo de Deploy

1. **Desenvolvimento local:** `npm run dev` + `wrangler dev`
2. **Frontend:** push na branch `main` → deploy automático via **Cloudflare Pages**
3. **Cloudflare Workers (API):** `wrangler deploy`

---

## Instruções para o Claude Code

- **Novo endpoint de API:** adicionar em `src/worker.ts` + função em `src/lib/api.ts`
- **Nova entidade de dados:** definir tipo em `src/types/index.ts` + dados mock em `src/data/mock.ts` + migration em `migrations/`
- **Nova página:** criar em `src/pages/` + registrar rota em `src/App.tsx` + adicionar link em `src/components/AppSidebar.tsx`
- **Novo componente UI:** verificar `src/components/ui/` (shadcn) antes de criar
- **Ao modificar o banco:** sempre criar migration em `migrations/`, nunca editar `schema.sql` diretamente
- **Nova extensão Chrome:** criar em `extension/<nome>/`, adicionar em `scripts/copy-extension.cjs`, adicionar aba em `Tools.tsx`, adicionar endpoint em `worker.ts`
- **Não commitar:** `.env.local`, `.wrangler/state/`

---

## Contexto de Negócio

O CRM foca em:
1. **Captura/extração de leads** via extensões do Instagram, Google Maps e WhatsApp
2. **Gestão do pipeline** de vendas
3. **Automação via bot** para follow-up de leads
4. **Dashboard** com métricas de conversão

---

## Problemas Conhecidos e Soluções

| Problema | Causa | Solução |
|---|---|---|
| `crypto.randomUUID()` retorna vazio no Worker | Não disponível em todos os contextos | Usar `crypto.getRandomValues(new Uint8Array(20))` + hex |
| Logo não aparece nas extensões (mostra "E") | `fill="url(#id)"` bloqueado pela CSP | Usar `div` com `background: linear-gradient(...)` no CSS |
| `chrome.windows.create({ state: "minimized" })` falha | Parâmetro inválido | Criar sem state, depois `chrome.windows.update(id, { state: "minimized" })` |
| Extensão trava ao extrair (Maps/Instagram) | `waitTabComplete` sem timeout | Usar deadline de 12s com `clearTimeout` no listener |
| CORS bloqueado de `chrome-extension://` | Origem não permitida | `isExtensionRoute && isExtensionOrigin` → allow `"*"` |
| Ícones não aparecem na extensão | PNG não incluído no ZIP | Adicionar `icon16.png`, `icon48.png`, `icon128.png` em `EXTENSION_FILES` no Tools.tsx |
