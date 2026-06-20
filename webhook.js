const express = require("express");
const router = express.Router();
const axios = require("axios");
const { procesarMensaje } = require("./responder");

// Definida con la "A" mayúscula
const enviarWhatsApp = async (telefono, texto) => {
  try {
    // 💡 Parche para Argentina: si viene con 5493865..., Meta exige mandar a 543865... (sin el 9)
    const telefonoLimpio = telefono.startsWith("549") 
      ? "54" + telefono.slice(3) 
      : telefono;

    const res = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: telefonoLimpio, // Usamos el número corregido
        type: "text",
        text: { body: texto },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Respuesta Meta:", res.data);
  } catch (err) {
    console.error("Error completo:", JSON.stringify(err.response?.data, null, 2));
    console.error("Phone ID usado:", process.env.WHATSAPP_PHONE_ID);
    console.error("Token usado (primeros 10 chars):", process.env.WHATSAPP_TOKEN?.slice(0, 10));
  }
};

// Verificación del webhook con Meta
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verificado ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recibir mensajes
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const mensaje = messages[0];
    const telefono = mensaje.from;
    const texto = mensaje.text?.body;

    if (!texto) return res.sendStatus(200);

    console.log(`📩 Mensaje de ${telefono}: ${texto}`);

    const respuesta = await procesarMensaje(texto);
    
    // Llamada corregida con la "A" mayúscula para que coincida con la definición
    await enviarWhatsApp(telefono, respuesta);

    console.log(`✅ Respuesta enviada a ${telefono}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;