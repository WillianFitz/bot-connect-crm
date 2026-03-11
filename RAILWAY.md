## Serviços Railway neste repositório

Este repo contém 2 serviços Node prontos para deploy no Railway, ambos dentro da pasta `railway/`:

- `railway/whatsapp-bot`: bot WhatsApp (usando `whatsapp-web.js`)
- `railway/instagram-extractor`: extrator Instagram (simulado, pronto para integrar Puppeteer)

### 1. Bot WhatsApp (`railway/whatsapp-bot`)

**Root Directory no Railway**: `railway/whatsapp-bot`

- `package.json` com script `"start": "node index.js"`.
- Endpoints:
  - `GET /status` — status da sessão (`disconnected` | `qr` | `connected`).
  - `GET /qr` — QR em texto (para debug).
  - `POST /send-message` — `{ to, message }`.

No painel da Railway:

1. Crie um serviço a partir deste repositório.
2. Em **Settings → Root Directory**, defina `railway/whatsapp-bot`.
3. Em **Deploy → Start Command**, deixe vazio (Railway usa `"start"` do `package.json`) ou defina `npm start`.
4. Aguarde o deploy e use a URL pública como `BOT_SERVICE_URL` no Worker.

### 2. Extrator Instagram (`railway/instagram-extractor`)

**Root Directory no Railway**: `railway/instagram-extractor`

- `package.json` com script `"start": "node index.js"`.
- Endpoint:
  - `POST /api/instagram/start` — recebe `{ jobId, tenantId, profile, callbackUrl }` do Worker.
  - Envia leads fake para `callbackUrl` (`/api/tools/instagram/push-leads` do Worker) para validar o fluxo.

No painel da Railway:

1. Crie outro serviço a partir do **mesmo repositório**.
2. Em **Settings → Root Directory**, defina `railway/instagram-extractor`.
3. Em **Deploy → Start Command**, deixe vazio ou use `npm start`.
4. Aguarde o deploy e use a URL pública como `EXTRACTOR_SERVICE_URL` no Worker.

