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

// Se eliminó la función enviarImagen ya que no la usaremos para evitar costos.

const buscarProductosDB = async (termino) => {
  const terminoExpandido = expandirTermino(termino);
  const palabras = terminoExpandido.split(" ").filter(p => p.length > 2);
  
  console.log("DEBUG: Buscando con:", palabras);
  if (palabras.length === 0) return [];

  const condiciones = palabras.map((_, i) => `p.name ILIKE $${i + 1}`).join(" AND ");
  const valores = palabras.map(p => `%${p}%`);

  const sql = `
    SELECT p.id, p.name, p.price_wholesale, p.stock_quantity
    FROM products p 
    WHERE p.available = true 
    AND (${condiciones})
    ORDER BY (CASE WHEN p.name ILIKE '%CELULAR%' THEN 1 ELSE 2 END) ASC, p.name ASC 
    LIMIT 5`;

  const resultados = await query(sql, valores).catch((err) => {
    console.error("DEBUG: Error en SQL:", err);
    return [];
  });

  console.log("DEBUG: Resultados encontrados:", resultados.length);
  return resultados;
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
        return res.sendStatus(200);
    }
    mensajesProcesados.add(messageId);
    setTimeout(() => mensajesProcesados.delete(messageId), 300000);

    if (enviandoDespedida.has(telefono)) {
      return res.sendStatus(200);
    }

    iniciarTimer(telefono);
    console.log(`📩 Mensaje de ${telefono} (tipo: ${tipo})`);

    if (["image", "video", "sticker"].includes(tipo)) {
      await enviarTexto(telefono, `📝 Por favor escribí el nombre del producto que buscás y te ayudamos enseguida. 😊`);
      return res.sendStatus(200);
    }

    if (["audio", "voice"].includes(tipo)) {
      await enviarTexto(telefono, `⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊`);
      return res.sendStatus(200);
    }

    if (tipo === "document") return res.sendStatus(200);

    const texto = mensaje.text?.body;
    if (!texto) return res.sendStatus(200);

    console.log(`💬 Texto: ${texto}`);

    const textoNorm = expandirTermino(
      texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/(precio|cuanto sale|cuanto cuesta|stock|tienen|hay|busco|quiero|tenes|consulta|me das|necesito)/g, "")
        .replace(/\s+/g, " ")
        .trim()
    );

    // --- NUEVA LÓGICA DE BIENVENIDA Y BÚSQUEDA ---
    const ES_SALUDO = /^(hola|buenas|buen[ao]s|hi|hey|ola|buenas noches|buenos dias|buenas tardes|buen dia)$/.test(textoNorm.replace(/[^a-z]/g, ""));
    const NO_ES_BUSQUEDA = /^[123]$/.test(texto) ||
      /^(horario|factura|envio|pago|redes|vendedor|mayorista|tecnico|pedido|web|reparacion|perfume|gracias|chau|adios)/i.test(textoNorm);

    // Si es un saludo directo o un inicio de chat, mandamos el mensaje integral.
    if (ES_SALUDO) {
        const msjBienvenida = `👋 ¡Hola! Bienvenido a *Concepción Tecnología*.\n\n🕐 *Nuestros horarios:*\n• Lunes a Viernes: 9:00 a 12:00 y 16:00 a 20:00 hs\n• Sábados: 9:00 a 15:00 hs (corrido)\n📍 *Ubicación:* Calle Independencia 450, Concepción, Tucumán\n🗺️ Ver en mapa: https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman\n\n🔍 *¿Qué estás buscando?*\nEscribí directamente el nombre del producto o repuesto (ej: _módulo A16_, _batería A20_, _funda_).\n\n📸 Para ver la foto y detalles del producto, ingresá en el link que te aparecerá en la respuesta.\n\n¡Gracias por elegirnos! 😊\n_Atte. Concepción Tecnología_`;
        await enviarTexto(telefono, msjBienvenida);
        return res.sendStatus(200);
    }

    const esBusqueda = textoNorm.length > 2 && !NO_ES_BUSQUEDA;

    if (esBusqueda) {
      const productos = await buscarProductosDB(textoNorm);
      console.log("DEBUG: Productos listos para armar string:", productos.length);

      if (productos.length > 0) {
        // Armamos un array con la información de cada producto
        const listaProductos = productos.map(p => {
            const link = `https://concepciontecnologia.vercel.app/mayorista/producto/${p.id}`;
            const precio = Number(String(p.price_wholesale).replace(/[^0-9.-]+/g, "") || 0);
            return `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(precio)}\n📦 Stock: ${p.stock_quantity} unidades\n🔗 ${link}`;
        });

        // Unimos todos los productos con un separador y agregamos el encabezado y cierre
        const msjFinal = `🔍 *Resultados de tu búsqueda:*\n\n${listaProductos.join("\n\n-------------------\n\n")}\n\n🛒 *Para realizar la compra o ver la foto completa, ingresá en el link del producto que elijas.*`;
        
        // ¡Enviamos TODO en un solo mensaje!
        await enviarTexto(telefono, msjFinal);
        return res.sendStatus(200);
      } else {
        await enviarTexto(telefono, `😕 No encontré resultados exactos para "${textoNorm}".\n\nPor favor indicanos la marca y modelo (ej: _Moto G54_, _Samsung A15_) o buscá en nuestra tienda:\n🌐 https://concepciontecnologia.vercel.app/mayorista`);
        return res.sendStatus(200);
      }
    }

    // Si no es saludo, ni búsqueda, pasamos al responder.js para las respuestas estáticas (horarios, gracias, etc.)
    const respuesta = await procesarMensaje(texto, tipo);
    if (respuesta) {
        await enviarTexto(telefono, respuesta);
    }
    
    console.log(`✅ Respuesta enviada a ${telefono}`);
    res.sendStatus(200);

  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;