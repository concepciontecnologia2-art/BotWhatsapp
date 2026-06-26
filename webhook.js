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
    console.error("Error enviarTexto:", JSON.stringify(err.response?.data, null, 2));
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
        image: { link: imageUrl, caption },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Error enviarImagen:", JSON.stringify(err.response?.data, null, 2));
  }
};

const buscarProductosDB = async (termino) => {
  const terminoExpandido = expandirTermino(termino);
  const palabras = terminoExpandido.split(" ").filter(p => p.length > 0);
  
  // Creamos condiciones tipo ILIKE para cada palabra
  // Usamos $1, $2, etc. porque tu DB es PostgreSQL
  if (palabras.length === 0) return [];
  const condiciones = palabras.map((_, index) => `p.name ILIKE $${index + 1}`).join(" AND ");
  const valores = palabras.map(p => `%${p}%`);

  const sql = `
    SELECT p.id, p.name, p.price_wholesale, p.stock_quantity, p.image_url
    FROM products p
    WHERE p.available = true 
    AND (${condiciones})
    ORDER BY p.name ASC 
    LIMIT 5`;

  const resultados = await query(sql, valores).catch((err) => {
    console.error("Error en DB:", err);
    return [];
  });

  return resultados;
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

    handleMessage(telefono);
    
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

    const respuesta = await procesarMensaje(texto, tipo);
    if (!respuesta) return res.sendStatus(200);

    const textoNorm = texto.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/(precio|cuanto sale|cuanto cuesta|stock|tienen|hay|busco|quiero|tenes|hola|buenas|consulta)/g, "")
      .replace(/\s+/g, " ").trim();

    const palabras = textoNorm.split(" ").filter(p => p.length > 1);

    const esBusqueda = textoNorm.length > 2 &&
      !texto.match(/^[123]$/) &&
      !texto.match(/(horario|factura|envio|pago|redes|vendedor|mayorista|tecnico|pedido|web|reparacion|perfume|funda|vidrio|gracias|chau)/i);

    if (esBusqueda) {
      const productos = await buscarProductosDB(textoNorm);

      if (productos.length > 0) {
        // 1. Enviamos el mensaje de texto de respuesta primero
        await enviarTexto(telefono, respuesta);
        
        // 2. Iteramos cada producto
        for (const p of productos) {
          const link = `https://concepciontecnologia.vercel.app/mayorista/producto/${p.id}`;
          
          // Limpieza de precio
          const precioLimpio = typeof p.price_wholesale === 'string' 
            ? p.price_wholesale.replace(/[^0-9.-]+/g, "") 
            : p.price_wholesale;
          const precio = Number(precioLimpio || 0);

          // Construimos el caption CON el link
          const caption = `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(precio)}\n📦 Stock: ${p.stock_quantity} unidades\n🔗 ${link}`;

          // Enviar imagen o texto según corresponda
          if (p.image_url) {
            await enviarImagen(telefono, p.image_url, caption);
          } else {
            await enviarTexto(telefono, caption);
          }
          
          // Pequeña pausa
          await new Promise(r => setTimeout(r, 500));
        }

        // 3. MENSAJE FINAL (Solo después de mostrar los productos)
        await enviarTexto(telefono, `Por favor, para realizar la compra ingresa en el link correspondiente al producto que elijas. Si deseas comprarlo por mayorista, ahi mismo veras un boton directo a compra mayorista. Espero haberte ayudado.`);
        
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

const timers = new Map();

function handleMessage(telefono) {
    if (timers.has(telefono)) {
        console.log(`⏱️ Reiniciando timer para ${telefono}`);
        clearTimeout(timers.get(telefono));
        timers.delete(telefono);
    }

    console.log(`⏱️ Timer iniciado para ${telefono} (5 minutos)`);

    const timer = setTimeout(async () => {
        console.log(`⏱️ Enviando despedida a ${telefono}`);
        
        const mensajeDespedida = "🙂 Parece que ya no estás aquí.\n\n🙏 ¡Muchas gracias por comunicarte con nosotros!\n\n🫡 Si necesitás algo más recordá que estamos a tu disposición!\n\n👋😁 ¡Que tengas un excelente día!";
        
        await enviarTexto(telefono, mensajeDespedida);
        timers.delete(telefono);
    }, 5 * 60 * 1000); 

    timers.set(telefono, timer);
}

module.exports = router;