const { query } = require("./db");

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const stockEmoji = (quantity) => (quantity > 0 ? "🟢" : "🔴");

const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const expandirTermino = (texto) => {
  return texto
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
    .replace(/\btemplados?\b/g, "templado")
    .replace(/\bparlantes?\b/g, "parlante")
    .replace(/\bauriculares?\b/g, "auricular")
    .replace(/\bperfumes?\b/g, "perfume")
    .replace(/\brepuestos?\b/g, "repuesto")
    .replace(/\bcelulares?\b/g, "celular")
    .replace(/\bsam\b/g, "samsung")
    .replace(/\bmoto\b/g, "motorola")
    .replace(/\biph\b/g, "iphone")
    .replace(/\bj2 prime\b/g, "samsung j2 prime")
    .replace(/\bj4\b/g, "samsung j4")
    .replace(/\bj5\b/g, "samsung j5")
    .replace(/\bj6\b/g, "samsung j6")
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
    .replace(/\bg14\b/g, "motorola g14");
};

const buscarProductos = async (termino) => {
  const terminoExpandido = expandirTermino(normalizar(termino));
  const palabras = terminoExpandido.split(" ").filter(p => p.length > 1);

  let resultados = await query(
    `SELECT p.id, p.name, p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available, p.image_url
     FROM products p
     WHERE p.name ILIKE $1 AND p.available = true
     ORDER BY p.name ASC LIMIT 5`,
    [`%${terminoExpandido}%`]
  );

  if (resultados.length === 0 && palabras.length > 1) {
    for (const palabra of palabras) {
      if (palabra.length < 2) continue;
      const r = await query(
        `SELECT p.id, p.name, p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available, p.image_url
         FROM products p
         WHERE p.name ILIKE $1 AND p.available = true
         ORDER BY p.name ASC LIMIT 5`,
        [`%${palabra}%`]
      );
      if (r.length > 0) { resultados = r; break; }
    }
  }

  return resultados;
};

const estaAbierto = () => {
  const now = new Date();
  const hora = now.getHours();
  const min = now.getMinutes();
  const dia = now.getDay();
  const h = hora + min / 60;
  if (dia === 0) return false;
  if (dia >= 1 && dia <= 5) return (h >= 9 && h < 12) || (h >= 16 && h < 20);
  if (dia === 6) return h >= 9 && h < 15;
  return false;
};

const procesarMensaje = async (mensaje, tipo = "text") => {

  if (["image", "video", "sticker"].includes(tipo)) {
    return `📝 Por favor escribí el nombre del producto que buscás y te ayudamos enseguida. 😊`;
  }
  if (["audio", "voice"].includes(tipo)) {
    return `⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊`;
  }
  if (tipo === "document") return null;

  const textoOriginal = mensaje.trim();
  const texto = normalizar(textoOriginal);

  // DESPEDIDA
  if (texto.match(/^(gracias|muchas gracias|gracia|ok gracias|dale gracias|buenas gracias|chau|adios|hasta luego|nos vemos|listo gracias|todo bien gracias|perfecto gracias)$/)) {
    return `🙏 *¡Muchas gracias por comunicarte con nosotros!*\n\n🫡 Si necesitás algo más recordá que estamos a tu disposición!\n\n👋😁 ¡Que tengas un excelente día!`;
  }

  // MAYOR O MENOR
  if (texto.match(/^(mayor|por mayor|precio mayor|mayorista)$/)) {
    return `🏪 *Precio Mayorista:*\n\nPara ver los precios mayoristas registrate acá:\n🌐 https://concepciontecnologia.vercel.app/mayorista\n\nO escribí *vendedor* para que te atienda alguien del local. 👨‍💼`;
  }
  if (texto.match(/^(menor|por menor|precio menor|minorista|precio minorista)$/)) {
    return `🛒 *Precio Minorista:*\n\nVisitá nuestra tienda para ver todos los precios:\n🌐 https://concepciontecnologia.vercel.app/\n\nO escribí *vendedor* para coordinar. 👨‍💼`;
  }

  // LO QUE NO VENDEN
  if (texto.match(/(camara delantera|camara trasera|camara de celular|camara de fotos)/)) {
    return `Solo vendemos cámaras de seguridad. 📹 No vendemos el repuesto de la cámara interna del celular.\n\n¿Puedo ayudarte con algo más? 😊`;
  }
  if (texto.match(/(flex de encendido|flex de volumen|flex encendido)/)) {
    return `Disculpá, por el momento no vendemos Flex de encendido ni de volumen. ❌\n\n¿Puedo ayudarte con algo más?`;
  }
  if (texto.match(/(parlante interno|microfono interno|auricular interno)/)) {
    return `Repuestos como parlantes internos, micrófonos y auriculares internos para celular no vendemos. ❌\n\n🎧 Lo que sí tenemos son parlantes Bluetooth y micrófonos para audio en general.\n\n¿Te interesa alguno?`;
  }
  if (texto.match(/(crema|maquillaje)/)) {
    return `Por el momento no trabajamos con líneas de cremas ni maquillaje. 😕\n\n¿Puedo ayudarte con algo más?`;
  }

  // FACTURA
  if (texto.match(/(factura|comprobante|emiten factura|hacen factura)/)) {
    return `✅ *¡Sí! Emitimos factura o comprobante de compra.*\n\nPodés solicitarla al momento de tu compra en el local o coordinar con un vendedor.\n\nEscribí *vendedor* si querés coordinar. 👨‍💼`;
  }

  // REDES SOCIALES
  if (texto.match(/(redes sociales|instagram|facebook|tiktok|redes|ig|fb)/)) {
    return `📱 *Nuestras Redes Sociales:*\n\n📘 Facebook: https://www.facebook.com/share/1GtkZrvC6L/?mibextid=wwXIfr\n📸 Instagram: https://www.instagram.com/concepciontecnologia\n🎵 TikTok: https://www.tiktok.com/@concepciontecnologia\n\n¡Seguinos para ver novedades y ofertas! 🔔`;
  }

  // HORARIO / UBICACIÓN
  if (texto.match(/(horario|hora|cuando abren|estan abiertos|abierto|cerrado|hasta que hora|sabado|donde estan|direccion|ubicacion|local|donde queda|estacionamiento)/)) {
    const abierto = estaAbierto();
    if (abierto) {
      return `✅ *¡Sí, estamos abiertos!*\n\n📍 Calle Independencia 450, Concepción, Tucumán\n🕐 *Lunes a Viernes:* 9:00 a 12:00 hs y 16:00 a 20:00 hs\n🗓️ *Sábados:* 9:00 a 15:00 hs (corrido)\n❌ Domingos y feriados cerrado\n🚗 Zona de fácil estacionamiento\n\n🗺️ https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    } else {
      return `😮 *OH NO, ESTAMOS CERRADOS*, pero te atenderemos lo antes posible.\n\n☝️😃 *NUESTROS HORARIOS DE ATENCIÓN*\n🕒 HORARIO LUN A VIER DE 9HS A 12HS Y DE 16HS A 20HS\nSÁBADO DE 9HS A 15HS\n🏪 Calle Independencia 450\n📍 https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    }
  }

  // SALUDO → MENÚ
  if (texto.match(/^(hola|buenas|buen[ao]s|hi|hey|ola|buenas noches|buenos dias|buenas tardes|buen dia|buena tarde|buena noche)/) && !texto.match(/(precio|cuanto|tenes|hay|stock|busco|quiero|modulo|bateria|pantalla|funda|cable)/)) {
    return `👋 ¡Bienvenido a *Concepción Tecnología*!\nEspecialistas en repuestos para celulares, electrónica y mucho más.\n\n¿En qué podemos ayudarte?\n\n1️⃣ Consultar un producto\n2️⃣ Horarios y ubicación 📍\n3️⃣ Hablar con un vendedor por WhatsApp 👨‍💼\n\n_Escribí el número de opción o tu consulta directamente._`;
  }

  // OPCIONES DEL MENÚ
  if (texto === "1") {
    return `🔍 ¡Perfecto! Escribime el nombre del producto o repuesto que buscás.\n\nEjemplo: _batería samsung a20_, _módulo moto g54_, _funda iphone 13_`;
  }
  if (texto === "2") {
    const abierto = estaAbierto();
    if (abierto) {
      return `☝️😃NUESTROS HORARIOS DE ATENCIÓN\n\n 
🕒HORARIO LUN A VIER DE 9HS A 12HS Y DE 16HS A 20HS\n\n 
SÁBADO DE 9HS A 15HS\n\n
🏪Calle Independencia 450\n\n 
📍 UBICACIÓN\n🗺️ https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    } else {
      return `😮 *OH NO, ESTAMOS CERRADOS*, pero te atenderemos lo antes posible.\n\n🕒 Lunes a Viernes de 9hs a 12hs y de 16hs a 20hs\n🕒 Sábado de 9hs a 15hs\n🏪 Calle Independencia 450`;
    }
  }
  if (texto === "3") {
    return `👨‍💼 *¡Claro! Te comunicamos con nuestro equipo.*\n\n✍️ Escribinos directamente y te atendemos:\n📲 https://wa.me/5493865630488\n\n🕐 HORARIO LUN A VIER DE 9HS A 12HS Y DE 16HS A 20HS\nSÁBADO DE 9HS A 15HS`;
  }

  // REPARACIONES
  if (texto.match(/(reparacion|arregla|arreglan|servicio tecnico|colocacion|cambiar pantalla|cambiar bateria|cuanto cuesta cambiar|cuanto tardan)/)) {
    return `🛠️ *Información sobre Servicio Técnico:*\n\nNo hacemos servicio técnico de colocación o reparación. 🛠️❌\n\nTrabajamos directo con los técnicos ya que *hay que probar los repuestos en el local*, de lo contrario salen sin garantía con la boleta.\n\n¿Puedo ayudarte con algo más? 😊`;
  }
// Una vez que el cliente responde, verificás si pregunta por el pago:
if (texto.toLowerCase().includes("efectivo") || texto.toLowerCase().includes("descuento")|| texto.toLowerCase().includes("haces decuento?")|| texto.toLowerCase().includes("aplicas descuento?")) {
    return `¡Excelente! Te comento, tenemos beneficios exclusivos para pago en efectivo:
    - 3% off en compras de $150.000.
    - 5% off en compras de $250.000.
    
    ¿Cuál es el monto total aproximado de tu compra para ver qué descuento te podemos aplicar?`;
}
  // MAYORISTA / TÉCNICOS
  if (texto.match(/(mayorista|tecnico|tecnicos|lista de precios|registrarme|reservar|reserva)/)) {
    if (texto.match(/(reserva|reservar)/)) {
      return `💵 *Reserva de Componentes:*\n\n¡Sí! Podés reservar tus repuestos asegurando el stock mediante una *transferencia bancaria/virtual*. Escribí *vendedor* para coordinar el pago.`;
    }
    return `🏪 *Atención a Técnicos y Mayoristas:*\n\n• 🛍️ *Compra Mínima Perfumes:* 3 unidades iguales o surtidas de 100ml.\n• 💵 *Descuentos Efectivo:* 3% en compras de $150.000 y 5% en compras de $250.000.\n• 📱 *Registro Mayorista:*\n🌐 https://concepciontecnologia.vercel.app/mayorista\n\n🚚 Repartos a locales comerciales en Concepción de Lunes a Sábados.`;
  }

  // PERFUMERÍA
  if (texto.match(/(perfume|saphirus|vishnu|arabe|fragancia|sahumerio|asad|masa|yara|badee|blush|lattafa)/)) {
    if (texto.match(/(recomienda|recomendas|hombre|mujer|mas vendido)/)) {
      return `🧴 *Recomendaciones Exclusivas:*\n\n🏆 *El más vendido:* Al Dur Al Maknoon 🥇\n\n🧔 *Para Hombre:* Asad, Masa, Al Dur Al Maknoon Silver.\n👩 *Para Mujer:* Yara 100 ML, Yara Candy, Badee Al Oud Noble BLUSH.\n\n✨ _¡Toda la línea árabe es 100% ORIGINAL!_\n\n¿Querés más info? Escribí *vendedor* o visitá nuestra tienda. 😊`;
    }
    if (texto.match(/(economico|barato)/)) {
      return `💰 *Perfumes Económicos:* Tenemos la línea *Maison Alhambra de 30ml* a solo *$20.000*.\n\n¿Querés más info? Escribí *vendedor* o visitá nuestra tienda. 😊`;
    }
    return `🛍️ *Perfumería & Fragancias:*\n• Toda la línea de *Saphirus* y Sahumerios *Vishnu*.\n• Gran variedad de *Perfumería Árabe* original (*Lattafa*, *Maison Alhambra*, etc.).\n\nEn el local podés sentir las fragancias. 👃\n\n¿Querés más info? Escribí *vendedor* o visitá nuestra tienda. 😊`;
  }

  // ENVÍOS
  if (texto.match(/(envio|domicilio|entrega|mandar|costo del envio|reparto)/)) {
    return `🚚 *Información de Envíos y Repartos:*\n\n• 📍 *En Concepción:* Entregas a locales L-S. Gratis si llevás un módulo o el pedido supera $10.000.\n• 🗓️ *Ruta de los Jueves:* Monteros · León Rouges · Villa Quinteros · Río Seco · Arcadia · Trinidad · Aguilares · Los Sarmientos · Río Chico · Santa Ana · Alberdi.\n\n📋 *Envíos Gratis por Mayor:*\n• 🔌 Electrónica: compras mayores a $80.000\n• 🧴 Saphirus: $30.000 en Concepción / $40.000 resto de provincia.`;
  }

  // MÉTODOS DE PAGO
  if (texto.match(/(pago|cuotas|pagar|tarjeta|transferencia|efectivo|metodo de pago)/)) {
    return `💳 *Formas de Pago:*\n\n• 📲 *Por Menor:* Transferencias y tarjetas en un solo pago SIN INTERÉS.\n• ❌ *Por Mayor:* Solo efectivo o transferencia.`;
  }

  // PEDIDOS / TIENDA WEB
  if (texto.match(/(pedido|comprar|quiero comprar|hacer pedido|tienda|pagina web|link|web)/)) {
    return `🛒 *¿Cómo hacer tu pedido?*\n\nPodés armar tu pedido o registrarte como mayorista en nuestra tienda:\n🌐 https://concepciontecnologia.vercel.app/\n\n📌 *Una vez enviado el pedido desde la web, la compra se concreta directamente con el dueño del local quien te va a contactar para coordinar el pago y la entrega.*`;
  }

  // VENDEDOR HUMANO
  if (texto.match(/(vendedor|humano|persona|hablar con|atencion|contacto|asesor)/)) {
    return `👨‍💼 *¡Claro! Te comunicamos con nuestro equipo.*\n\n✍️ Escribinos directamente y te atendemos:\n📲 https://wa.me/5493865630488\n\n🕐 HORARIO LUN A VIER DE 9HS A 12HS Y DE 16HS A 20HS\nSÁBADO DE 9HS A 15HS`;
  }

  // BÚSQUEDA DINÁMICA
  let limpio = texto
    .replace(/(hola|buenas|buenos dias|buenas tardes|buenas noches|buen dia|che|como estas|todo bien)/g, "")
    .replace(/(consulta|queria saber|por favor|porfa|me podrias decir)/g, "")
    .replace(/(precio|cuanto sale|cuanto cuesta|cual es el precio|valor)/g, "")
    .replace(/(stock|tienen|hay|busco|quiero|necesito|me das|tenes|disponible|conseguis)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const terminoBusqueda = expandirTermino(limpio);

  if (terminoBusqueda.length > 2) {
    const productos = await buscarProductos(terminoBusqueda);

    if (productos.length === 0) {
      return `😕 No encontré ese producto en el sistema.\n\nPor favor indicanos la *marca y modelo exacto* (ej: _Samsung A15, Moto G54, iPhone 13_) y qué componente buscás.\n\nO escribí al local directamente:\n📞 https://wa.me/5493865630488`;
    }

    // Devolver resumen — el webhook envía foto+link por separado
    const resumen = productos.map(p =>
      `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio mayorista: ${fmt(Number(p.price_wholesale))}`
    ).join("\n\n");

    return `🔍 *Esto encontré en el sistema:*\n\n${resumen}\n\n🟢 En stock`;
  }

  // RESPUESTA POR DEFECTO
  return `No entendí bien tu consulta 😅\n\nTe comunicamos con el local para que te ayuden:\n📞 https://wa.me/5493865630488\n\nO escribí directamente lo que buscás. 😊`;
};

module.exports = { procesarMensaje };