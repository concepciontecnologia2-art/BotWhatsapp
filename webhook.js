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
    .replace(/\btextiles?\b/g, "textil")
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
    .replace(/\ba16\b/g, "samsung a16")
    replace(/\ba16\b/g, "celular samsung a16")
    .replace(/\ba06\b/g, "a06")
    .replace(/\ba07\b/g, "a07")
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
  const terminoNormalizado = termino.toLowerCase();
  
  // 1. FILTRO VIP: Si busca el A16, forzamos la búsqueda de ese producto exacto
  if (terminoNormalizado.includes("a16")) {
    const resVip = await query(
      `SELECT id, name, price_wholesale, stock_quantity, image_url 
       FROM products 
       WHERE name ILIKE '%A16%' AND name ILIKE '%CELULAR%' 
       LIMIT 1`
    ).catch(() => []);
    
    // Si lo encontró, lo devolvemos inmediatamente como prioridad 1
    if (resVip.length > 0) return resVip;
  }

  // Intento 1: AND con todas las palabras
  const condicionesAnd = palabras.map((_, i) => `p.name ILIKE $${i + 1}`).join(" AND ");
  const valores = palabras.map(p => `%${p}%`);
  let resultados = await query(
    `SELECT p.id, p.name, p.price_wholesale, p.stock_quantity, p.image_url
     FROM products p WHERE p.stock_quantity >= 0 AND (${condicionesAnd})
     ORDER BY p.name ASC LIMIT 8`,
    valores
  ).catch(() => []);

  // Intento 2: Solo palabras clave sin genéricas
  if (resultados.length === 0 && palabras.length > 1) {
    const PALABRAS_GENERICAS = ["bateria", "modulo", "pantalla", "cable", "cargador", "funda", "tapa", "placa", "pin", "vidrio", "textil", "celular"];
    const palabrasClave = palabras.filter(p => !PALABRAS_GENERICAS.includes(p));
    if (palabrasClave.length > 0) {
      const condClave = palabrasClave.map((_, i) => `p.name ILIKE $${i + 1}`).join(" AND ");
      const valoresClave = palabrasClave.map(p => `%${p}%`);
      resultados = await query(
        `SELECT p.id, p.name, p.price_wholesale, p.stock_quantity, p.image_url
         FROM products p WHERE p.stock_quantity >= 0 AND (${condClave})
         ORDER BY p.name ASC LIMIT 8`,
        valoresClave
      ).catch(() => []);
    }
  }

  // Intento 3: Primera palabra
  if (resultados.length === 0) {
    const primeraPalabra = palabras[0];
    resultados = await query(
      `SELECT p.id, p.name, p.price_wholesale, p.stock_quantity, p.image_url
       FROM products p WHERE p.stock_quantity >= 0 AND p.name ILIKE $1
       ORDER BY p.name ASC LIMIT 8`,
      [`%${primeraPalabra}%`]
    ).catch(() => []);
  }

  return resultados;
};

// Timer de despedida
const timers = new Map();
const enviandoDespedida = new Set();

const iniciarTimer = (telefono) => {
  if (timers.has(telefono)) clearTimeout(timers.get(telefono));
  const timer = setTimeout(async () => {
    enviandoDespedida.add(telefono);
    await enviarTexto(telefono,
      `🙂 Parece que ya no estás aquí.\n\n🙏 *¡Muchas gracias por comunicarte con nosotros!*\n\n🫡 Si necesitás algo más recordá que estamos a tu disposición!\n\n👋😁 ¡Que tengas un excelente día!`
    );
    timers.delete(telefono);
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

    if (enviandoDespedida.has(telefono)) {
      console.log(`⏱️ Ignorando mensaje durante despedida`);
      return res.sendStatus(200);
    }

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

    // NO es búsqueda si es opción de menú o palabra clave de otra función
    const NO_ES_BUSQUEDA = /^[123]$/.test(texto) ||
      /^(horario|factura|envio|pago|redes|vendedor|mayorista|tecnico|pedido|web|reparacion|perfume|gracias|chau|hola|buenas|adios|mayor|menor)/i.test(texto);

    const esBusqueda = textoNorm.length > 2 && !NO_ES_BUSQUEDA;

    if (esBusqueda) {
      const productos = await buscarProductosDB(textoNorm);

      if (productos.length > 0) {
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
        return res.sendStatus(200);
      } else {
        await enviarTexto(telefono, `😕 No encontré ese producto.\n\nIndicanos la *marca y modelo exacto* o escribí al local:\n📞 https://wa.me/5493865630488`);
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