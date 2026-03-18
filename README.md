# LeadFlowAI

Plataforma SaaS de prospecção automática de leads com agentes de IA, CRM integrado e automação via WhatsApp.

## Stack

- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend**: Cloudflare Workers + D1 (SQLite)
- **Storage**: Cloudflare R2
- **Deploy**: Cloudflare Pages (frontend) + Cloudflare Workers (API)

## Desenvolvimento local

```bash
npm install
npm run dev        # Frontend (Vite)
wrangler dev       # Worker + D1 local
```

## Deploy

```bash
npm run build      # Build do frontend
wrangler deploy    # Deploy do Worker
```
