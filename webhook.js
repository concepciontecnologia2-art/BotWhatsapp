const express = require("express");
const router = express.Router();
const axios = require("axios");
const { procesarMensaje } = require("./responder");
const { query } = require("./db");

const expandirTermino = (texto) => {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bmodulos?\b/g, "modulo")
    .replace(/\bbaterias?\b/g, "bateria")
    .replace(/\bpantallas?\b/g, "pantalla")
    .replace(/\bfundas?\b/g, "funda")
    .replace(/\bcarcasas?\b/g, "funda")
    .replace(/\bprotectores?\b/g, "funda")
    .replace(/\bcargadores?\b/g, "cargador")
    .replace(/\bcables?\b/g, "cable")
    .replace(/\blinternas?\b/g, "linterna")
    .replace(/\btapas?\b/g, "tapa")
    .replace(/\bplacas?\b/g, "placa")
    .replace(/\bpines?\b/g, "pin")
    .replace(/\bvidrios?\b/g, "vidrio")
    .replace(/\bparlantes?\b/g, "parlante")
    .replace(/\bauriculares?\b/g, "auricular")
    .replace(/\bsam\b/g, "samsung")
    .replace(/\bmoto\b/g, "motorola")
    .replace(/\bj2 prime\b/g, "samsung j2 prime")
    .replace(/\bj4\b/g, "samsung j4")
    .replace(/\bj5\b/g, "samsung j5")
    .replace(/\ba20\b/g, "samsung a20")
    .replace(/\ba21\b/g, "samsung a21")
    .replace(/\ba30\b/g, "samsung a30")
    .replace(/\ba50\b/g, "samsung a50")
    .replace(/\ba10\b/g, "samsung a10")
    .replace(/\ba12\b/g, "samsung a12")
    .replace(/\ba13\b/g, "samsung a13")
    .replace(/\ba14\b/g, "samsung a14")
    .replace(/\ba15\b/g, "samsung a15")
    .replace(/\ba32\b/g, "samsung a32")
    .replace(/\bg54\b/g, "motorola g54")
    .replace(/\bg84\b/g, "motorola g84")
    .replace(/\bg14\b/g, "motorola g14")
    .replace(/\s+/g, " ")
    .trim();
};

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const stockEmoji = (q) => (q > 0 ? "🟢" : "🔴");

const enviarTexto = async (telefono, texto) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to: telefono, type: "text", text: { body: texto } },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error enviarTexto:", JSON.stringify(err.response?.data, null, 2));
  }
};

const enviarImagen = async (telefono, imageUrl, caption) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      { messaging_product: "whatsapp", to: telefono, type: "image", image: { link: imageUrl, caption } },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error enviarImagen:", JSON.stringify(err.response?.data, null, 2));
  }
};
const buscarProductosDB = async (termino) => {
  const terminoExpandido = expandirTermino(termino);
  const palabras = terminoExpandido.split(" ").filter(p => p.length > 1);
  if (palabras.length === 0) return [];

  // Búsqueda única y precisa: debe contener TODAS las palabras ingresadas
  const condiciones = palabras.map((_, i) => `p.name ILIKE $${i + 1}`).join(" AND ");
  const valores = palabras.map(p => `%${p}%`);

  const sql = `SELECT p.id, p.name, p.price_wholesale, p.stock_quantity, p.image_url
               FROM products p 
               WHERE p.available = true 
               AND (${condiciones})
               ORDER BY p.name ASC LIMIT 5`;

  return await query(sql, valores).catch(() => []);
};
// Timer de despedida — separado por usuario
const timers = new Map();
const enviandoDespedida = new Set(); // evitar bucle

const iniciarTimer = (telefono) => {
  if (timers.has(telefono)) {
    clearTimeout(timers.get(telefono));
  }
  const timer = setTimeout(async () => {
    console.log(`⏱️ Enviando despedida a ${telefono}`);
    enviandoDespedida.add(telefono);
    await enviarTexto(telefono,
      `🙂 Parece que ya no estás aquí.\n\n🙏 *¡Muchas gracias por comunicarte con nosotros!*\n\n🫡 Si necesitás algo más recordá que estamos a tu disposición!\n\n👋😁 ¡Que tengas un excelente día!`
    );
    timers.delete(telefono);
    // Limpiar el flag después de 10 segundos
    setTimeout(() => enviandoDespedida.delete(telefono), 10000);
  }, 5 * 60 * 1000);
  timers.set(telefono, timer);
};

// Verificación webhook
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

const mensajesProcesados = new Set();
// Recibir mensajes
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return res.sendStatus(404);

    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages || messages.length === 0) return res.sendStatus(200);

    const mensaje = messages[0];
    const telefono = mensaje.from;
    const tipo = mensaje.type;

    // --- ESCUDO ANTI-BUCLE ---
        const messageId = mensaje.id;
        if (mensajesProcesados.has(messageId)) {
            return res.sendStatus(200); // Ya lo procesamos, ignorar
        }
        mensajesProcesados.add(messageId);

        setTimeout(() => mensajesProcesados.delete(messageId), 300000);

    // Si estamos enviando la despedida, ignorar el mensaje entrante
    if (enviandoDespedida.has(telefono)) {
      console.log(`⏱️ Ignorando mensaje de ${telefono} durante despedida`);
      return res.sendStatus(200);
    }

    // Reiniciar timer con cada mensaje real del usuario
    iniciarTimer(telefono);

    console.log(`📩 Mensaje de ${telefono} (tipo: ${tipo})`);

    // Imagen
    if (["image", "video", "sticker"].includes(tipo)) {
      await enviarTexto(telefono, `📝 Por favor escribí el nombre del producto que buscás y te ayudamos enseguida. 😊`);
      return res.sendStatus(200);
    }

    // Audio
    if (["audio", "voice"].includes(tipo)) {
      await enviarTexto(telefono, `⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊`);
      return res.sendStatus(200);
    }

    // Documento
    if (tipo === "document") return res.sendStatus(200);

    const texto = mensaje.text?.body;
    if (!texto) return res.sendStatus(200);

    console.log(`💬 Texto: ${texto}`);

    const respuesta = await procesarMensaje(texto, tipo);
    if (!respuesta) return res.sendStatus(200);

    // Normalizar para búsqueda
    const textoNorm = expandirTermino(
      texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/(precio|cuanto sale|cuanto cuesta|stock|tienen|hay|busco|quiero|tenes|hola|buenas|consulta|me das|necesito)/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );

    // Detectar si es búsqueda de producto — INCLUYE funda y vidrio
    const NO_ES_BUSQUEDA = /^[123]$/.test(texto) ||
      /^(horario|factura|envio|pago|redes|vendedor|mayorista|tecnico|pedido|web|reparacion|perfume|gracias|chau|hola|buenas|adios)/i.test(texto);

    const esBusqueda = textoNorm.length > 2 && !NO_ES_BUSQUEDA;
if (esBusqueda) {
      const productos = await buscarProductosDB(textoNorm);

      if (productos.length > 0) {
        await enviarTexto(telefono, respuesta);

        for (const p of productos) {
          const link = `https://concepciontecnologia.vercel.app/mayorista/producto/${p.id}`;
          const precio = Number(String(p.price_wholesale).replace(/[^0-9.-]+/g, "") || 0);
          const caption = `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(precio)}\n📦 Stock: ${p.stock_quantity} unidades\n🔗 ${link}`;

          if (p.image_url) {
            await enviarImagen(telefono, p.image_url, caption);
          } else {
            await enviarTexto(telefono, caption);
          }
          await new Promise(r => setTimeout(r, 500));
        }

        await enviarTexto(telefono, `Para realizar la compra ingresá en el link del producto que elijas. 😊`);
        return res.sendStatus(200);
      } else {
        // AQUÍ ESTÁ LA CLAVE: Si no encuentra nada, avisamos al usuario
        await enviarTexto(telefono, `No encontré resultados exactos para "${textoNorm}". Por favor, intentá ser más específico o verificá el nombre del producto. 😊`);
        return res.sendStatus(200);
      }
    }

    await enviarTexto(telefono, respuesta);
    console.log(`✅ Respuesta enviada a ${telefono}`);
    res.sendStatus(200);

  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;