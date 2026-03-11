import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post("/api/instagram/start", async (req, res) => {
  const { jobId, tenantId, profile, callbackUrl } = req.body || {};

  if (!jobId || !tenantId || !profile || !callbackUrl) {
    return res
      .status(400)
      .json({ error: "jobId, tenantId, profile e callbackUrl são obrigatórios" });
  }

  console.log("Novo job Instagram:", { jobId, tenantId, profile, callbackUrl });

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

