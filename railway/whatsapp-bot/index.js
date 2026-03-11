import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let connectionStatus = "disconnected";
let lastQr = null;
let sock = null;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // QR também aparece nos logs do Railway
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQr = qr;
      connectionStatus = "qr";
      console.log("Novo QR gerado (será exibido no frontend).");
    }

    if (connection === "open") {
      console.log("WhatsApp conectado");
      connectionStatus = "connected";
    } else if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "Conexão fechada. Reconnecting? ",
        shouldReconnect,
        lastDisconnect?.error,
      );
      connectionStatus = "disconnected";
      if (shouldReconnect) {
        startWhatsApp().catch((err) =>
          console.error("Erro ao reconectar WhatsApp:", err),
        );
      }
    } else if (connection === "connecting") {
      connectionStatus = "connecting";
    }
  });
}

startWhatsApp().catch((err) =>
  console.error("Erro ao iniciar WhatsApp:", err),
);

app.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
  });
});

app.get("/qr", (req, res) => {
  if (!lastQr) {
    return res.status(404).json({ qr: null, error: "QR não disponível" });
  }
  return res.json({ qr: lastQr });
});

app.post("/send-message", async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res
      .status(400)
      .json({ error: "to e message são obrigatórios" });
  }

  if (!sock) {
    return res.status(500).json({ error: "Sessão WhatsApp ainda não iniciada" });
  }

  try {
    await sock.sendMessage(to, { text: message });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp bot ouvindo em http://0.0.0.0:${PORT}`);
});

