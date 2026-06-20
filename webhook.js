const express = require("express");
const router = express.Router();
const axios = require("axios");
const { procesarMensaje } = require("./responder");

const enviarWhatsApp = async (telefono, texto) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: telefono,
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
  } catch (err) {
    console.error("Error al enviar:", JSON.stringify(err.response?.data, null, 2));
  }
};

const enviarImagen = async (telefono, imageUrl, caption) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: telefono,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error al enviar imagen:", JSON.stringify(err.response?.data, null, 2));
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
    if (body.object !== "whatsapp_business_account") return res.sendStatus(404);

    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages || messages.length === 0) return res.sendStatus(200);

    const mensaje = messages[0];
    const telefono = mensaje.from;
    const tipo = mensaje.type; // text, image, audio, video, document, sticker

    console.log(`📩 Mensaje de ${telefono} (tipo: ${tipo})`);

    // Ignorar imágenes silenciosamente
    if (["image", "video", "document", "sticker"].includes(tipo)) {
      console.log("🖼️ Imagen/video recibido — ignorando");
      return res.sendStatus(200);
    }

    // Audios → responder que no se aceptan
    if (["audio", "voice"].includes(tipo)) {
      await enviarWhatsApp(telefono, "⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊");
      return res.sendStatus(200);
    }

    const texto = mensaje.text?.body;
    if (!texto) return res.sendStatus(200);

    console.log(`💬 Texto: ${texto}`);

    const respuesta = await procesarMensaje(texto, tipo);

    if (!respuesta) return res.sendStatus(200); // null = no contestar

    // Buscar si la respuesta tiene productos con imágenes para enviar como imagen
    const { query } = require("./db");
    const terminoLimpio = texto.toLowerCase()
      .replace(/(precio|stock|tienen|hay|busco|quiero|tenes|hola|buenas)/g, "")
      .replace(/\s+/g, " ").trim();

    if (terminoLimpio.length > 2) {
      const productos = await query(
        `SELECT id, name, price_retail, stock_quantity, image_url
         FROM products WHERE name ILIKE $1 AND available = true LIMIT 3`,
        [`%${terminoLimpio}%`]
      ).catch(() => []);

      // Si hay productos con foto, enviar imagen primero
      for (const p of productos) {
        if (p.image_url) {
          const caption = `🛒 *${p.name}*\n💰 $${Number(p.price_retail).toLocaleString("es-AR")}\n📦 Stock: ${p.stock_quantity} u.\n🔗 https://concepciontecnologia.vercel.app/producto/${p.id}`;
          await enviarImagen(telefono, p.image_url, caption);
        }
      }
    }

    await enviarWhatsApp(telefono, respuesta);
    console.log(`✅ Respuesta enviada a ${telefono}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;