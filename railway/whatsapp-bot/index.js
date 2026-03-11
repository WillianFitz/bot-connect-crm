import express from "express";
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const app = express();
app.use(express.json());

const SESSION_NAME = "bot-connect-crm";
const PORT = process.env.PORT || 3000;

let connectionStatus = "disconnected";
let lastQr = null;

const client = new Client({
  authStrategy: new LocalAuth({ clientId: SESSION_NAME }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  connectionStatus = "qr";
  lastQr = qr;
  console.log("QR recebido. Escaneie no WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp pronto!");
  connectionStatus = "connected";
});

client.on("disconnected", () => {
  console.log("WhatsApp desconectado");
  connectionStatus = "disconnected";
});

client.initialize();

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
    hasQr: !!lastQr,
  });
});

app.get("/qr", (req, res) => {
  if (!lastQr) return res.status(404).json({ error: "QR não disponível" });
  res.json({ qr: lastQr });
});

app.post("/send-message", async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res
      .status(400)
      .json({ error: "to e message são obrigatórios" });
  }

  try {
    await client.sendMessage(to, message);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp bot ouvindo em http://0.0.0.0:${PORT}`);
});

