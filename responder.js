const { query } = require("./db");

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

const stockEmoji = (quantity) => (quantity > 0 ? "🟢" : "🔴");

const buscarProductos = async (termino) => {
  return await query(
    `SELECT p.id, p.name, p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available, p.image_url
     FROM products p
     WHERE p.name ILIKE $1 AND p.available = true
     ORDER BY p.name ASC
     LIMIT 5`,
    [`%${termino}%`]
  );
};

// Verificar si estamos en horario de atención
const estaAbierto = () => {
  const now = new Date();
  const hora = now.getHours();
  const minutos = now.getMinutes();
  const dia = now.getDay(); // 0=domingo, 1=lunes...6=sábado
  const horaDecimal = hora + minutos / 60;

  if (dia === 0) return false; // domingo cerrado
  if (dia >= 1 && dia <= 5) {
    // lunes a viernes
    return (horaDecimal >= 9 && horaDecimal < 12) || (horaDecimal >= 16 && horaDecimal < 20);
  }
  if (dia === 6) {
    // sábado
    return horaDecimal >= 9 && horaDecimal < 15;
  }
  return false;
};

const procesarMensaje = async (mensaje, tipo = "text") => {
  // IGNORAR AUDIOS E IMÁGENES
  if (tipo === "audio" || tipo === "voice") {
    return `⚠️ Este número no recibe audios ni llamadas. Por favor escribinos tu consulta por texto. ¡Gracias! 😊`;
  }
  if (tipo === "image" || tipo === "video" || tipo === "document" || tipo === "sticker") {
    return null; // no contestar imágenes
  }

  const texto = mensaje.toLowerCase().trim();

  // =================================================================
  // FILTRO: LO QUE NO VENDEN
  // =================================================================
  if (texto.match(/(camara delantera|camara trasera|camara de celular|camara de fotos celular)/)) {
    return `Solo vendemos cámaras de seguridad. 📹 No vendemos el repuesto de la cámara interna del celular.`;
  }
  if (texto.match(/(flex de encendido|flex de volumen|flex encendido)/)) {
    return `Disculpá, por el momento no vendemos Flex de encendido ni de volumen. ❌`;
  }
  if (texto.match(/(parlante interno|microfono interno|auricular interno|parlante de repuesto|microfono de repuesto)/)) {
    return `Repuestos como parlantes internos, micrófonos para celular y auriculares internos no vendemos. ❌\n\n🎧 Lo que sí tenemos disponible son parlantes Bluetooth y micrófonos con cable o inalámbricos para audio en general.`;
  }
  if (texto.match(/(crema|cremas|maquillaje|maquillajes)/)) {
    return `Por el momento no trabajamos con líneas de cremas ni maquillaje. 😕`;
  }

  // =================================================================
  // FACTURA / COMPROBANTE
  // =================================================================
  if (texto.match(/(factura|comprobante|emiten factura|hacen factura|tienen factura)/)) {
    return `✅ *¡Sí! Emitimos factura o comprobante de compra.*\n\nPodés solicitarla al momento de tu compra en el local o coordinar con un vendedor si es venta online.\n\nEscribí *vendedor* si querés coordinar. 👨‍💼`;
  }

  // =================================================================
  // REDES SOCIALES
  // =================================================================
  if (texto.match(/(redes sociales|instagram|facebook|tiktok|redes|ig|fb)/)) {
    return `📱 *Nuestras Redes Sociales:*\n\n📘 Facebook: https://www.facebook.com/share/1GtkZrvC6L/?mibextid=wwXIfr\n📸 Instagram: https://www.instagram.com/concepciontecnologia\n🎵 TikTok: https://www.tiktok.com/@concepciontecnologia\n\n¡Seguinos para ver novedades, ofertas y más! 🔔`;
  }

  // =================================================================
  // HORARIO / ABIERTO O CERRADO
  // =================================================================
  if (texto.match(/(horario|hora|cuando abren|estan abiertos|abierto|cerrado|hasta que hora|sabad|sábado|donde estan|direccion|ubicacion|local|donde queda|estacionamiento)/)) {
    const abierto = estaAbierto();
    if (abierto) {
      return `✅ *¡Sí, estamos abiertos!*\n\n📍 Calle Independencia 450, Concepción, Tucumán\n🕐 *Lunes a Viernes:* 9:00 a 12:00 hs y 16:00 a 20:00 hs\n🗓️ *Sábados:* 9:00 a 15:00 hs (corrido)\n❌ Domingos y feriados cerrado\n🚗 Zona de fácil estacionamiento\n\n🗺️ https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    } else {
      return `😮 *OH NO, ESTAMOS CERRADOS*, pero te atenderemos lo antes posible en nuestro horario de trabajo.\n\n🕒 Lunes a Viernes de 9hs a 12hs y de 16hs a 20hs\n🕒 Sábado de 9hs a 15hs\n🏪 Calle Independencia 450\n\n🔖 Nuestro WSP: https://wa.me/c/5493865630488`;
    }
  }

  // =================================================================
  // SALUDO INICIAL → MENÚ
  // =================================================================
  if (texto.match(/^(hola|buenas|buen[ao]s|hi|hey|ola|buenas noches|buenos dias|buenas tardes)/)) {
    return `👋 ¡Bienvenido a *Concepción Tecnología*!\nEspecialistas en repuestos para celulares 📱🔧\n\n¿En qué podemos ayudarte?\n\n1️⃣ Consultar un producto\n2️⃣ Horarios y ubicación 📍\n3️⃣ Hablar con un vendedor por WhatsApp 👨‍💼\n\n_Escribí el número de opción o tu consulta directamente._`;
  }

  // OPCIONES DEL MENÚ
  if (texto === "1") {
    return `🔍 ¡Perfecto! Escribime el nombre del producto o repuesto que buscás.\n\nEjemplo: _batería samsung a20_, _módulo moto g54_, _funda iphone 13_`;
  }
  if (texto === "2") {
    const abierto = estaAbierto();
    if (abierto) {
      return `✅ *¡Estamos abiertos ahora!*\n\n📍 Calle Independencia 450, Concepción, Tucumán\n🕐 *L-V:* 9-12 y 16-20hs · *Sáb:* 9-15hs\n🗺️ https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    } else {
      return `😮 *OH NO, ESTAMOS CERRADOS*, pero te atenderemos lo antes posible.\n\n🕒 Lunes a Viernes de 9hs a 12hs y de 16hs a 20hs\n🕒 Sábado de 9hs a 15hs\n🏪 Calle Independencia 450\n\n🔖 Nuestro WSP: https://wa.me/c/5493865630488`;
    }
  }
  if (texto === "3") {
    return `👨‍💼 Te estoy comunicando con un asesor en el local. ¡Aguardame un segundo!\n\n📞 También podés escribirnos directamente: https://wa.me/c/5493865630488`;
  }

  // =================================================================
  // REPARACIONES
  // =================================================================
  if (texto.match(/(reparacion|reparación|arregla|arreglan|servicio tecnico|servicio técnico|colocacion|colocación|cambiar pantalla|cambiar bateria|cuanto cuesta cambiar|cuanto tardan)/)) {
    return `🛠️ *Información sobre Servicio Técnico:*\n\nNo hacemos servicio técnico de colocación o reparación. 🛠️❌\n\nTrabajamos directo con los técnicos ya que *hay que probar los repuestos en el local*, de lo contrario salen sin garantía con la boleta.`;
  }

  // =================================================================
  // CARGADORES IPHONE / CABLES
  // =================================================================
  if (texto.match(/(cargador iphone|cargador de iphone|cable iphone|cable usb iphone|cable lightning|cable tipo c|cable usb c|cable ficha c|cable p datos|cable de datos)/)) {
    const productos = await buscarProductos(
      texto.includes("iphone") ? "cargador iphone" :
      texto.includes("tipo c") || texto.includes("ficha c") || texto.includes("usb c") ? "cable tipo c" :
      "cable"
    );
    if (productos.length === 0) {
      return `😕 No encontré ese cable/cargador en el sistema en este momento.\n\nConsultá con un *vendedor* para verificar disponibilidad.`;
    }
    const lista = productos.map((p) => {
      const link = `https://concepciontecnologia.vercel.app/producto/${p.id}`;
      return `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 ${fmt(Number(p.price_retail))}\n📦 Stock: ${p.stock_quantity} u.\n🔗 ${link}`;
    }).join("\n\n---\n\n");
    return `🔍 Esto encontré:\n\n${lista}\n\n¿Querés hacer un pedido? Escribí *pedido* o visitá nuestra tienda. 🛒`;
  }

  // =================================================================
  // FUNDAS → MAYOR O MENOR
  // =================================================================
  if (texto.match(/(funda|fundas|vidrio|templado|tapa trasera|carcasa)/) && !texto.match(/(mayor|menor)/)) {
    return `📱 ¡Sí tenemos! ¿Deseás por:\n\n✳️ *Mayor*\n✳️ *Menor*\n\nEscribí tu opción y el modelo de tu celular para darte el precio.`;
  }

  // =================================================================
  // MAYORISTA / TÉCNICOS
  // =================================================================
  if (texto.match(/(mayorista|mayoristas|tecnico|técnico|tecnicos|técnicos|lista de precios|registrarme|reservar|reserva|mayor)/)) {
    if (texto.match(/(reserva|reservar)/)) {
      return `💵 *Reserva de Componentes:*\n\n¡Sí! Podés reservar tus repuestos asegurando el stock mediante una *transferencia bancaria/virtual*. Escribí *vendedor* para coordinar el pago.`;
    }
    return `🏪 *Atención a Técnicos y Mayoristas:*\n\n• 🛍️ *Compra Mínima Perfumes:* 3 unidades iguales o surtidas de 100ml.\n• 💵 *Descuentos Efectivo:* 3% en compras de $150.000 y 5% en compras de $250.000.\n• 📱 *Registro Mayorista:* Ingresá directamente en:\n🌐 https://concepciontecnologia.vercel.app/mayorista\n\n🚚 Realizamos repartos a locales comerciales en Concepción de Lunes a Sábados.`;
  }

  // =================================================================
  // PERFUMERÍA
  // =================================================================
  if (texto.match(/(perfume|perfumes|saphirus|vishnu|arabe|árabe|fragancia|sahumerio|asad|masa|yara|badee|blush|lattafa)/)) {
    if (texto.match(/(recomienda|recomendas|hombre|mujer|mas vendido|más vendido)/)) {
      return `🧴 *Recomendaciones Exclusivas:*\n\n🏆 *El más vendido:* Al Dur Al Maknoon 🥇\n\n🧔 *Para Hombre:* Asad, Masa, Al Dur Al Maknoon Silver.\n👩 *Para Mujer:* Yara 100 ML, Yara Candy, Badee Al Oud Noble BLUSH.\n\n✨ _¡Toda la línea árabe es 100% ORIGINAL!_`;
    }
    if (texto.match(/(economico|economicos|barato)/)) {
      return `💰 *Perfumes Económicos:* Tenemos la línea *Maison Alhambra de 30ml* a solo *$20.000*.`;
    }
    return `🛍️ *Perfumería & Fragancias:*\n• Toda la línea de *Saphirus* y Sahumerios *Vishnu*.\n• Gran variedad de *Perfumería Árabe* original (*Lattafa*, *Maison Alhambra*, etc.).\n\nEn el local podés sentir las fragancias. 👃`;
  }

  // =================================================================
  // ENVÍOS
  // =================================================================
  if (texto.match(/(envio|envios|domicilio|entrega|mandar|costo del envio|reparto|repartos)/)) {
    return `🚚 *Información de Envíos y Repartos:*\n\n• 📍 *En Concepción:* Entregas a locales comerciales L-S. Gratis si llevás un módulo o el pedido supera $10.000.\n• 🗓️ *Ruta de los Jueves:* Monteros · León Rouges · Villa Quinteros · Río Seco · Arcadia · Concepción · Trinidad · Aguilares · Los Sarmientos · Río Chico · Santa Ana · Alberdi.\n\n📋 *Envíos Gratis por Mayor:*\n• 🔌 Electrónica: compras mayores a $80.000\n• 🧴 Saphirus: $30.000 en Concepción / $40.000 resto de provincia.`;
  }

  // =================================================================
  // MÉTODOS DE PAGO
  // =================================================================
  if (texto.match(/(pago|cuotas|pagar|tarjeta|tarjetas|transferencia|efectivo|metodo de pago)/)) {
    return `💳 *Formas de Pago:*\n\n• 📲 *Por Menor:* Transferencias y tarjetas de crédito en un solo pago SIN INTERÉS.\n• ❌ *Por Mayor:* Solo efectivo o transferencia. (No se recibe tarjeta de crédito en compras mayoristas).`;
  }

  // =================================================================
  // PEDIDOS / TIENDA WEB
  // =================================================================
  if (texto.match(/(pedido|comprar|quiero comprar|hacer pedido|tienda|pagina web|link|web)/)) {
    return `🛒 *¿Cómo hacer tu pedido?*\n\nPodés armar tu pedido o registrarte como mayorista en nuestra tienda:\n🌐 https://concepciontecnologia.vercel.app/`;
  }

  // =================================================================
  // VENDEDOR HUMANO
  // =================================================================
  if (texto.match(/(vendedor|humano|persona|hablar con|atencion|atención|contacto)/)) {
    return `👨‍💼 Te estoy comunicando con un asesor en el local. ¡Aguardame un segundo!\n\n📞 También podés escribirnos: https://wa.me/c/5493865630488`;
  }

  // =================================================================
  // BÚSQUEDA DINÁMICA EN BASE DE DATOS
  // =================================================================
  let limpio = texto
    .replace(/(hola|buenas|buenos dias|buenas tardes|buenas noches|che|como estas|todo bien)/g, "")
    .replace(/(consulta|te hago una consulta|quería saber|queria saber|por favor|porfa)/g, "")
    .replace(/(escu|escuchame|me podrias decir)/g, "");

  const terminoBusqueda = limpio
    .replace(/(precio|cuanto sale|cuanto cuesta|cual es el precio|valor)/g, "")
    .replace(/(stock|tienen|hay|busco|quiero|necesito|me das|tenes|tenés|disponible)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (terminoBusqueda.length > 2) {
    const productos = await buscarProductos(terminoBusqueda);

    if (productos.length === 0) {
      return `🕒 *Estamos verificando la disponibilidad...*\n\nNo encontré ese producto en el sistema. Por favor asegurate de indicar la *marca y modelo exacto* (ej: _Samsung A15, Moto G54, iPhone 13_) y qué componente buscás.\n\nO escribí *vendedor* para que te consulte alguien en el mostrador. 👨‍💼`;
    }

    const lista = productos.map((p) => {
      const link = `https://concepciontecnologia.vercel.app/producto/${p.id}`;
      const imagen = p.image_url ? `\n🖼️ Foto: ${p.image_url}` : "";
      return `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(Number(p.price_retail))}${imagen}\n📦 Stock: ${p.stock_quantity} u.\n🔗 Ver y comprar: ${link}`;
    }).join("\n\n---\n\n");

    return `🔍 Esto encontré en el sistema:\n\n${lista}\n\n¿Querés hacer el pedido? Entrá al link o escribí *pedido*. 🛒`;
  }

  // =================================================================
  // RESPUESTA POR DEFECTO
  // =================================================================
  return `No entendí bien tu consulta 😅\n\nEscribí una opción:\n• 1️⃣ *Consultar un producto*\n• 2️⃣ *Horarios y ubicación*\n• 3️⃣ *Hablar con un vendedor*\n\nO escribí directamente lo que buscás. 😊`;
};

module.exports = { procesarMensaje };