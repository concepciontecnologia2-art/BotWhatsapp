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
  const palabras = terminoExpandido.split(" ").filter(p => p.length > 1);

  let resultados = await query(
    `SELECT p.id, p.name, p.price_retail, p.stock_quantity, p.image_url
     FROM products p
     WHERE p.name ILIKE $1 AND p.available = true
     ORDER BY p.name ASC LIMIT 5`,
    [`%${terminoExpandido}%`]
  ).catch(() => []);

  if (resultados.length === 0 && palabras.length > 1) {
    for (const palabra of palabras) {
      if (palabra.length < 2) continue;
      const r = await query(
        `SELECT p.id, p.name, p.price_retail, p.stock_quantity, p.image_url
         FROM products p
         WHERE p.name ILIKE $1 AND p.available = true
         ORDER BY p.name ASC LIMIT 5`,
        [`%${palabra}%`]
      ).catch(() => []);
      if (r.length > 0) { resultados = r; break; }
    }
  }

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
    
    // Declaración explícita antes de usarla
    const telefono = mensaje.from;
    const tipo = mensaje.type;

    // Ahora la variable 'telefono' ya existe y tiene valor, podemos llamar a la función
    handleMessage(telefono);
    
    console.log(`📩 Mensaje de ${telefono} (tipo: ${tipo})`);

    
    // IMAGEN → pedir que escriba
    if (["image", "video", "sticker"].includes(tipo)) {
      await enviarTexto(telefono, `📝 Por favor escribí el nombre del producto que buscás y te ayudamos enseguida. 😊`);
      return res.sendStatus(200);
    }

    // AUDIO → rechazar
    if (["audio", "voice"].includes(tipo)) {
      await enviarTexto(telefono, `⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊`);
      return res.sendStatus(200);
    }

    // DOCUMENTO → ignorar
    if (tipo === "document") return res.sendStatus(200);

    const texto = mensaje.text?.body;
    if (!texto) return res.sendStatus(200);

    console.log(`💬 Texto: ${texto}`);

    // Procesar respuesta principal
    const respuesta = await procesarMensaje(texto, tipo);
    if (!respuesta) return res.sendStatus(200);

    // Detectar si es una búsqueda de producto
    const textoNorm = texto.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/(precio|cuanto sale|cuanto cuesta|stock|tienen|hay|busco|quiero|tenes|hola|buenas|consulta)/g, "")
      .replace(/\s+/g, " ").trim();

    const esBusqueda = textoNorm.length > 2 &&
      !texto.match(/^[123]$/) &&
      !texto.match(/(horario|factura|envio|pago|redes|vendedor|mayorista|tecnico|pedido|web|reparacion|perfume|funda|vidrio|gracias|chau)/i);

    if (esBusqueda) {
      const productos = await buscarProductosDB(textoNorm);

      if (productos.length > 0) {
        // Primero enviar el mensaje resumen
        await enviarTexto(telefono, respuesta);

        // Después enviar cada producto individualmente con foto y link
        for (const p of productos) {
          const link = `https://concepciontecnologia.vercel.app/mayorista/producto/${p.id}`;
          // En lugar de: Number(p.price_wholesale)
// Usá esta versión que limpia el string:
const precioLimpio = typeof p.price_wholesale === 'string' 
    ? p.price_wholesale.replace(/[^0-9.-]+/g, "") 
    : p.price_wholesale;

const precio = Number(precioLimpio || 0);

const caption = `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(precio)}\n📦 Stock: ${p.stock_quantity} unidades\n🔗 ${link}`;

          if (p.image_url) {
            await enviarImagen(telefono, p.image_url, caption);
          } else {
            await enviarTexto(telefono, caption);
          }

          // Pequeña pausa entre mensajes para no saturar
          await new Promise(r => setTimeout(r, 500));
        }

        // Mensaje final preguntando mayor o menor
        await enviarTexto(telefono, `Por favor, para realizar la compra ingresa en el link correspondiente al producto que elijas. Si deseas comprarlo por mayorista, ahi mismo veras un boton directo a compra mayorista. Espero haberte ayudado.`);

        return res.sendStatus(200);
      }
    }

    // Respuesta normal
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
    // Si ya existe, lo eliminamos
    if (timers.has(telefono)) {
        console.log(`⏱️ Reiniciando timer para ${telefono}`);
        clearTimeout(timers.get(telefono));
        timers.delete(telefono); // Borramos la referencia vieja
    }

    console.log(`⏱️ Timer iniciado para ${telefono} (4 minutos)`);

   // 2. Creamos el nuevo timer de 2 minutos
const timer = setTimeout(async () => {
    console.log(`⏱️ Enviando despedida a ${telefono}`);
    
    const mensajeDespedida = "🙂 Parece que ya no estás aquí.\n\n🙏 ¡Muchas gracias por comunicarte con nosotros!\n\n🫡 Si necesitás algo más recordá que estamos a tu disposición!\n\n👋😁 ¡Que tengas un excelente día!";
    
    await enviarTexto(telefono, mensajeDespedida);
    
    // Limpiamos el mapa después de enviar
    timers.delete(telefono);
}, 5 * 60 * 1000); // 2 minutos

    timers.set(telefono, timer);
}
module.exports = router;