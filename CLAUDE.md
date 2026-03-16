# CLAUDE.md — bot-connect-crm

Este arquivo orienta o Claude Code sobre a arquitetura, convenções e fluxo de trabalho do projeto.

---

## Visão Geral do Projeto

**bot-connect-crm** é um CRM com extração de leads, automação via bot e integração com redes sociais (Instagram). Gerado inicialmente via Lovable, evoluído para desenvolvimento local.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI Components | shadcn/ui + Tailwind CSS |
| Banco de dados | Cloudflare D1 (SQLite distribuído) |
| Backend/Edge | Cloudflare Workers (wrangler) |
| Deploy | Railway + Cloudflare |
| Testes | Vitest + Playwright |
| Extensão | Chrome Extension (Instagram scraper) |

---

## Estrutura de Pastas

```
bot-connect-crm/
├── src/
│   ├── App.tsx                 # Componente raiz + definição de rotas
│   ├── main.tsx                # Entry point React
│   ├── worker.ts               # Cloudflare Worker (API edge)
│   ├── App.css / index.css     # Estilos globais
│   │
│   ├── pages/                  # Uma página = uma rota
│   │   ├── Dashboard.tsx       # Visão geral / métricas
│   │   ├── Leads.tsx           # Gestão de leads extraídos
│   │   ├── Funnels.tsx         # Funis de vendas
│   │   ├── Campaigns.tsx       # Campanhas de marketing/bot
│   │   ├── Agents.tsx          # Agentes / atendentes
│   │   ├── Appointments.tsx    # Agendamentos
│   │   ├── Connections.tsx     # Conexões (WhatsApp, Instagram, etc.)
│   │   ├── Tools.tsx           # Ferramentas / integrações
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
│   │   └── index.ts            # Tipos TypeScript compartilhados (Lead, Funnel, etc.)
│   │
│   ├── data/
│   │   └── mock.ts             # Dados mock para desenvolvimento/testes
│   │
│   └── test/
│       ├── example.test.ts     # Testes de exemplo
│       └── setup.ts            # Setup do Vitest
│
├── extension/instagram/        # Extensão Chrome — extração de leads do Instagram
├── migrations/                 # Migrations do banco D1 (SQL incremental)
├── public/                     # Assets estáticos
├── railway/                    # Configurações de deploy no Railway
├── scripts/                    # Scripts utilitários
├── .wrangler/                  # Estado local do Cloudflare Workers (não editar)
├── schema.sql                  # Schema principal do banco de dados
├── wrangler.toml               # Configuração do Cloudflare Workers/D1
├── vite.config.ts              # Configuração do Vite
├── tailwind.config.ts          # Configuração do Tailwind
└── components.json             # Configuração do shadcn/ui
```

---

## Banco de Dados

- **Cloudflare D1** (SQLite na edge) — definido em `wrangler.toml`
- Schema em `schema.sql`
- Migrations incrementais em `migrations/`
- Para aplicar migrations localmente: `wrangler d1 migrations apply <DB_NAME> --local`
- Para produção: `wrangler d1 migrations apply <DB_NAME> --remote`

---

## Comandos Principais

```bash
npm run dev          # Inicia servidor de desenvolvimento (Vite)
npm run build        # Build de produção
npm run preview      # Preview do build
npm run test         # Testes unitários (Vitest)
npx playwright test  # Testes e2e (Playwright)
wrangler dev         # Inicia Workers local com D1
wrangler deploy      # Deploy para Cloudflare
```

---

## Módulos do CRM

### `src/pages/` — Páginas principais
| Página | Descrição |
|---|---|
| `Dashboard.tsx` | Métricas gerais, StatCards, visão executiva |
| `Leads.tsx` | Lista e gestão de leads captados |
| `Funnels.tsx` | Funis de vendas e etapas do pipeline |
| `Campaigns.tsx` | Campanhas de disparo via bot |
| `Agents.tsx` | Gerenciamento de agentes/atendentes |
| `Appointments.tsx` | Agendamentos e calendário |
| `Connections.tsx` | Conexões com canais (WhatsApp, Instagram) |
| `Tools.tsx` | Ferramentas e integrações externas |
| `Settings.tsx` | Configurações do sistema |
| `Admin.tsx` / `AdminLogin.tsx` | Área administrativa |
| `ClientLogin.tsx` | Acesso de clientes |

### `src/worker.ts` — API Edge (Cloudflare Worker)
Backend da aplicação rodando na edge da Cloudflare. Recebe requisições do frontend via `src/lib/api.ts`. Acessa o banco D1 diretamente.

### `src/lib/api.ts` — Cliente de API
Todas as chamadas HTTP ao `worker.ts` passam por aqui. Ao adicionar um novo endpoint no worker, criar a função correspondente em `api.ts`.

### `src/types/index.ts` — Tipos globais
Todos os tipos compartilhados (Lead, Funnel, Campaign, Agent, etc.) ficam aqui. **Sempre atualizar este arquivo ao criar novas entidades.**

### `src/data/mock.ts` — Dados mock
Usado para desenvolvimento sem backend ativo. Manter sincronizado com os tipos em `index.ts`.

### `extension/instagram/` — Extensão Chrome
Extrai leads do Instagram (perfis, seguidores, dados de contato). Usa Manifest V3. Envia dados para o `worker.ts` via API.

---

## Convenções de Código

- **TypeScript** em todo o projeto — sem `any` sem justificativa
- Componentes React: nomeados em **PascalCase**, um componente por arquivo
- Componentes UI: usar **shadcn/ui** sempre que disponível antes de criar custom
- Estilização: **Tailwind CSS** — evitar CSS inline ou arquivos `.css` separados
- Funções utilitárias: pasta `src/lib/` ou `src/utils/`
- Tipos compartilhados: pasta `src/types/`

---

## Variáveis de Ambiente

Referência em `.env.production`. Para desenvolvimento local, criar `.env.local` (não commitado).

Principais variáveis esperadas:
- `VITE_API_URL` — URL da API/Worker
- Credenciais D1 e bindings Cloudflare (definidos no `wrangler.toml`)

---

## Fluxo de Deploy

1. **Desenvolvimento local:** `npm run dev` + `wrangler dev`
2. **Staging/Railway:** push na branch `main` → deploy automático via Railway
3. **Cloudflare Workers:** `wrangler deploy`

---

## Instruções para o Claude Code

- **Novo endpoint de API:** adicionar em `src/worker.ts` + função em `src/lib/api.ts`
- **Nova entidade de dados:** definir tipo em `src/types/index.ts` + dados mock em `src/data/mock.ts` + migration em `migrations/`
- **Nova página:** criar em `src/pages/` + registrar rota em `src/App.tsx` + adicionar link em `src/components/AppSidebar.tsx`
- **Novo componente UI:** verificar `src/components/ui/` (shadcn) antes de criar — se já existir, usar o existente
- **Ao modificar o banco:** sempre criar migration em `migrations/`, nunca editar `schema.sql` diretamente
- **Extensão Chrome:** arquivos em `extension/instagram/` seguem Manifest V3
- **Testes:** ao adicionar lógica crítica (extração de leads, funis, campanhas), adicionar teste em `src/test/`
- **Não commitar:** `.env.local`, `.wrangler/state/`

---

## Contexto de Negócio

O CRM foca em:
1. **Captura de leads** via extensão do Instagram
2. **Gestão do pipeline** de vendas
3. **Automação via bot** para follow-up de leads
4. **Dashboard** com métricas de conversão

Ao implementar novas features, considerar sempre esses 4 pilares.
