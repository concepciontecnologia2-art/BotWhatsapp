const { query } = require("./db");

// Formateador de precios (Moneda ARS sin decimales)
const fmt = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

// Selector de emojis según la cantidad de stock real
const stockEmoji = (quantity) => {
  return quantity > 0 ? "🟢" : "🔴";
};

// Función de consulta a la Base de Datos
const buscarProductos = async (termino) => {
  return await query(
    `SELECT p.id, p.name, p.price_retail, p.price_wholesale, p.stock_quantity, p.stock_level, p.available
     FROM products p
     WHERE p.name ILIKE $1 AND p.available = true
     ORDER BY p.name ASC
     LIMIT 5`,
    [`%${termino}%`]
  );
};

const procesarMensaje = async (mensaje) => {
  const texto = mensaje.toLowerCase().trim();

  // =================================================================
  // 1 FILTRO DE RECHAZO: LO QUE NO VENDEN
  // =================================================================
  // Cámaras de celular
  if (texto.match(/(camara delantera|camara trasera|camara de celular|camara de fotos celular)/)) {
    return `Solo vendemos cámaras de seguridad. 📹 No vendemos el repuesto de la cámara interna del celular.`;
  }
  // Flex de encendido
  if (texto.match(/(flex de encendido|flex de volumen|flex encendido)/)) {
    return `Disculpá, por el momento no vendemos Flex de encendido ni de volumen. ❌`;
  }
  // Componentes internos micro
  if (texto.match(/(parlante interno|microfono interno|auricular interno|parlante de repuesto|microfono de repuesto)/)) {
    return `Repuestos como parlantes internos, micrófonos para celular y auriculares internos no vendemos. ❌\n\n🎧 Lo que sí tenemos disponible son parlantes Bluetooth y micrófonos con cable o inalámbricos para audio en general.`;
  }
  // Cremas/Maquillajes
  if (texto.match(/(crema|cremas|maquillaje|maquillajes)/)) {
    return `Por el momento no trabajamos con líneas de cremas ni maquillaje. 😕`;
  }

  // =================================================================
  // 2 SALUDO INICIAL
  // =================================================================
  if (texto.match(/^(hola|buenas|buen[ao]s|hi|hey|ola)/) && !texto.match(/(precio|cuanto sale|cuanto cuesta|tenes|tenés|hay|stock)/)) {
    return `👋 ¡Bienvenido a *Concepción Tecnología*!\nEspecialistas en repuestos para celulares 📱🔧, accesorios y perfumeria. \n\n¿En qué podemos ayudarte?\n\n1️⃣ Consultar un repuesto / Perfume 📱🧴\n2️⃣ Ver precios 💰\n3️⃣ Atención mayorista / Soy Técnico 🔧\n4️⃣ Reparaciones y Servicio Técnico 🛠️\n5️⃣ Horarios y ubicación 📍\n6️⃣ Hablar con un vendedor por WhatsApp 👨‍💼\n\n_Escribí el número de opción o tu consulta directamente._`;
  }

  // =================================================================
  // 3 REPARACIONES Y SERVICIO TÉCNICO
  // =================================================================
  if (texto.match(/(reparacion|reparación|arregla|arreglan|servicio tecnico|servicio técnico|colocacion|colocación|cambiar pantalla|cambiar bateria|cuanto cuesta cambiar|cuanto tardan)/)) {
    return `🛠️ *Información sobre Servicio Técnico:*\n\nNo hacemos servicio técnico de colocación o reparación. 🛠️❌\n\nTrabajamos directo con los técnicos ya que **hay que probar los repuestos en el local**, de lo contrario salen sin garantía con la boleta.`;
  }

  // =================================================================
  // 4 MARCAS DE REPUESTOS, VIDRIOS Y TAPAS
  // =================================================================
  if (texto.match(/(que marca de perfumes|marcas de repuesto|vidrio|templado|funda|fundas|tapa trasera|carcasa|carcasas|que perfumes tenes| )/)) {
    if (texto.match(/(vidrio|templado|funda)/)) {
      return `📱 *Protectores y Fundas:*\n\n• Sí, tenemos **vidrio templado 21D** y vidrio común disponible para varios modelos.\n Fundas si. ¿Buscas por mayor o por menor?`;
    }
    if (texto.match(/(tapa|carcasa)/)) {
      return `📱 *Tapas Traseras:*\n\n• ¡Sí vendemos tapas traseras para tu celular! Consultanos por tu modelo exacto.`;
    }
    return `⚙️ *Marcas de repuestos con las que trabajamos:*\n\n• 📱 **Módulos/Pantallas:** Trabajamos con la marca profesional *MECÁNICO* y también disponemos de una línea económica.\n• 🔋 **Baterías:** Trabajamos con la línea premium *FOXCONN* y también contamos con opción económica.`;
  }

  // =================================================================
  // 5 ATENCIÓN A TÉCNICOS, MAYORISTAS Y RESERVAS
  // =================================================================
  if (texto.match(/(mayorista|mayoristas|tecnico|técnico|tecnicos|técnicos|lista de precios|registrarme|reservar|reserva)/)) {
    if (texto.match(/(reserva|reservar)/)) {
      return `💵 *Reserva de Componentes:*\n\n¡Sí! Podés reservar tus repuestos o productos asegurando el stock mediante una **transferencia bancaria/virtual**. Escribí *vendedor* para coordinar el pago.`;
    }
    return `🏪 *Atención a Técnicos y Mayoristas:*\n\n• 🛍️ **Compra Mínima Perfumes:** 3 unidades iguales o surtidas de 100ml.\n• 💵 **Descuentos Efectivo (Por Mayor):** 3% en compras de $150.000 y 5% en compras de $250.000.\n• 📱 **Registro Mayorista:** Podés registrarte ingresando directamente al siguiente enlace de la app:\n🌐 https://concepciontecnologia.vercel.app/\n\n🚚 Realizamos repartos a locales comerciales en *Concepción de Lunes a Sábados*.`;
  }

  // =================================================================
  // 6 SECCIÓN PERFUMERÍA
  // =================================================================
  if (texto.match(/(perfume|perfumes|saphirus|vishnu|arabe|árabe|fragancia|sahumerio|asad|masa|yara|badee|blush)/)) {
    if (texto.match(/(recomienda|recomendas|recomiendan|hombre|mujer|mas vendido|más vendido)/)) {
      return `🧴 *Nuestras Recommendations Exclusivas:*\n\n🏆 *El más vendido:* Al Dur Al Maknoon 🥇\n\n🧔 *Para Hombre:* Asad, Masa, Al Dur Al Maknoon Silver.\n👩 *Para Mujer:* Yara 100 ML, Yara Candy, Badee Al Oud Noble BLUSH.\n\n✨ _¡Toda la línea árabe es 100% ORIGINAL!_`;
    }
    if (texto.match(/(economico|economicos|barato)/)) {
      return `💰 *Perfumes Económicos:* Tenemos la línea *Maison Alhambra de 30ml* a solo **$20.000**.`;
    }
    return `🛍️ *Perfumería & Fragancias:*\n• Toda la línea de *Saphirus* y Sahumerios *Vishnu*.\n• Gran variedad de *Perfumería Árabe* original (*Lattafa*, *Maison Alhambra*, etc.). En el local podés sentir las fragancias.`;
  }

  // =================================================================
  // 7 ENVÍOS, LOGÍSTICA Y CRITERIOS DE ENVÍO GRATIS
  // =================================================================
  if (texto.match(/(envios|envio|domicilio|entrega|mandar|cuanto tarda|costo del envio|costo envio|reparto|repartos|haces envio hasta|asta|)/)) {
    return `🚚 *Información de Envíos y Repartos:*

• 📍 **En Concepción:** Hacemos entregas a **locales comerciales de Lunes a Sábados**. El envío es 🆓 *GRATIS* en la línea de repuestos si llevás un módulo o si el pedido supera los **$10.000**.
• 🗓️ **Ruta de los Jueves (Zonas de Entrega Mayorista):**
  ✅ Monteros · ✅ León Rouges · ✅ Villa Quinteros · ✅ Río Seco · ✅ Arcadia · ✅ Concepción · ✅ Trinidad · ✅ Aguilares · ✅ Los Sarmientos · ✅ Río Chico · ✅ Santa Ana · ✅ Alberdi.

📋 **Envíos Gratis por Mayor (Otras líneas):**
• 🔌 *Electrónica:* Gratis en compras mayores a **$80.000**.
• 🧴 *Saphirus:* Compra mínima de **$30.000** en Concepción / **$40.000** en el resto de la provincia.

⏱️ *Demora:* Depende de la cantidad de pedidos que salgan del día.`;
  }

  // =================================================================
  // 8 MÉTODOS DE PAGO
  // =================================================================
  if (texto.match(/(metodo de pago|pago|cuotas|pagar|cuota|tarjeta|tarjetas|transferencia|efectivo)/)) {
    return `💳 *Formas de Pago:*

• 📲 **Por Menor:** Aceptamos transferencias y tarjetas de crédito en **un solo pago SIN INTERÉS**.
• ❌ **Por Mayor:** Recibimos efectivo o transferencia. (Para compras mayoristas *no se recibe tarjeta de crédito*).`;
  }

  // =================================================================
  // 9 ENLACES A LA TIENDA WEB / PEDIDOS
  // =================================================================
  if (texto.match(/(pedido|comprar|quiero comprar|hacer pedido|tienda|pagina web|página web|link|web|instagram)/)) {
    return `🛒 *¿Cómo hacer tu pedido?*\n\nPodés armar tu pedido o registrarte como mayorista directamente en nuestra tienda virtual oficial haciendo clic acá:\n🌐 https://concepciontecnologia.vercel.app/`;
  }

  // LOCAL, DIRECCIÓN, ESTACIONAMIENTO Y HORARIOS
  if (texto.match(/(hasta que hora estan|asta que hora|q hora|q ora|donde estan|direccion|ubicacion|local|donde queda|encuentran|ubicados|horario|hora|cuando abren|sabad|sábado|sabado|estacionamiento|esta abierto|abierto|hasta que hora estan|estan)/)) {
    return `📍 *Local, Dirección y Horarios:*\n\n• 🗺️ **Dirección:** Calle Independencia 450, Concepción, Tucumán.\n• 🚗 **Estacionamiento:** Zona de *fácil estacionamiento* para vehículos.\n• 🕐 **Horario Lunes a Viernes:** 9:00 a 12:00 hs y 16:00 a 20:00 hs.\n• 🗓️ **Sábados:** 9:00 a 15:00 hs (Horario corrido).\n❌ *Domingos y feriados cerrado.*\n\n🗺️ Google Maps: https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
  }

  // 🧑‍💼 ATENCIÓN HUMANA
  if (texto.match(/(vendedor|humano|persona|hablar con|atención|atencion|contacto|whatsapp)/)) {
    return `👨‍💼 Te estoy comunicando con un asesor en el local. ¡Aguardame un segundo!`;
  }

  // =================================================================
  // 🧼 LIMPIEZA AVANZADA DE MENSAJES PERSONALIZADOS
  // =================================================================
  let limpio = texto
    .replace(/(hola|buenas|buenos dias|buenas tardes|che|seba|sebastian|como estas|cómo estás|todo bien|todo vientos)/g, "")
    .replace(/(escu|escuchame|consulta|una consulta|te hago una consulta|quería saber|queria saber)/g, "")
    .replace(/(por favor|porfa|me podrias decir|me podrías decir)/g, "");

  const terminoBusqueda = limpio
    .replace(/(precio|cuanto sale|cuanto cuesta|cual es el precio|cuál es el precio|valor)/g, "")
    .replace(/(stock|tienen|hay|busco|quiero|necesito|me das|tenes|tenés|disponibilidad|disponible)/g, "")
    .replace(/(y cual es|y cuál es|su precio|el precio)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // =================================================================
  // 🔍 BÚSQUEDA DINÁMICA POR BASE DE DATOS + LINKS AUTOMÁTICOS
  // =================================================================
  if (terminoBusqueda.length > 2) {
    const productos = await buscarProductos(terminoBusqueda);

    if (productos.length === 0) {
      return `🕒 *Estamos verificando la disponibilidad del repuesto o producto para tu equipo...*\n\nPara darte una respuesta exacta, por favor asegúrate de indicarnos la **marca y modelo exacto** (Ej: _Samsung A15, Moto G54, iPhone 13_) y qué componente buscás. O bien escribí *vendedor* para que consulte un chico en el mostrador.`;
    }

    const lista = productos
      .map((p) => {
        const linkProducto = `https://concepciontecnologia.vercel.app/producto/${p.id}`;
        return `${stockEmoji(p.stock_quantity)} *${p.name}*\n💰 Precio: ${fmt(Number(p.price_retail))}\n📦 Stock: ${p.stock_quantity} unidades\n🌐 Ver fotos y comprar: ${linkProducto}`;
      })
      .join("\n\n---\n\n");

    return `🔍 Esto encontré en el sistema:\n\n${lista}\n\n¿Querés realizar el pedido? Podés comprar directo desde los links o escribir *pedido*.`;
  }

  // =================================================================
  // ⚙️ RESPUESTA POR DEFECTO
  // =================================================================
  return `No entendí bien tu consulta 😅\n\nEscribí una opción o palabra clave:\n• 1️⃣ *Repuesto* (Consultar para tu modelo)\n• 2️⃣ *Precios* (Módulos Mechanic, Baterías Foxconn)\n• 3️⃣ *Técnico* (Ventajas mayoristas y repartos)\n• 4️⃣ *Reparación* (Términos de servicio técnico)\n• 👨‍💼 *Vendedor* (Hablar con el local)`;
};

module.exports = { procesarMensaje };