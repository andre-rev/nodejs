import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import rateLimit from "express-rate-limit"; // <-- NEU

const app = express();
app.use(cors());
app.use(express.json());

// ---- Rate-Limiter für /api/chat (max. 5 Requests pro Minute/IP) ----
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 5,
  message: { reply: "Zu viele Anfragen. Bitte warte eine Minute." }
});
app.use("/api/chat", limiter);

// ---- POST /api/chat (Chatbot + optional Lead) ----
app.post("/api/chat", async (req, res) => {
  const { userMessage, leadData } = req.body;
  try {
    // 1. Anfrage an OpenAI (Chat)
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Du bist Klartext-GPT – ein B2B-Vertriebsdiagnostiker ohne Blabla. Du sprichst direkt, klar, kompetent." },
          { role: "user", content: userMessage }
        ]
      })
    });
    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || "Leider keine Antwort erhalten.";

    // 2. Lead zu HubSpot schicken (optional)
    if (leadData && leadData.email) {
      await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          properties: {
            email: leadData.email,
            firstname: leadData.firstname || "",
            lastname: leadData.lastname || "",
            phone: leadData.phone || ""
          }
        })
      });
    }

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Serverfehler." });
  }
});

// ---- Bereitstellen ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Klartext-GPT API läuft auf Port ${PORT}`);
});
