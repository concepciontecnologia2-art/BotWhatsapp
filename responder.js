const normalizar = (texto) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  if (!mensaje || typeof mensaje !== "string") return null;

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
    return `✅ *¡Sí! Emitimos factura o comprobante de compra.*\n\nPodés solicitarla al momento de tu compra en el local o coordinar con un vendedor. 👨‍💼`;
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
      return `😮 *OH NO, ESTAMOS CERRADOS*, pero te atenderemos lo antes posible.\n\n☝️😃 *NUESTROS HORARIOS DE ATENCIÓN*\n🕒 LUN A VIER DE 9HS A 12HS Y DE 16HS A 20HS\nSÁBADO DE 9HS A 15HS\n🏪 Calle Independencia 450\n📍 https://maps.google.com/?q=Independencia+450+Concepcion+Tucuman`;
    }
  }

  // REPARACIONES
  if (texto.match(/(reparacion|arregla|arreglan|servicio tecnico|colocacion|cambiar pantalla|cambiar bateria|cuanto cuesta cambiar|cuanto tardan)/)) {
    return `🛠️ *Información sobre Servicio Técnico:*\n\nNo hacemos servicio técnico de colocación o reparación. 🛠️❌\n\nTrabajamos directo con los técnicos ya que *hay que probar los repuestos en el local*, de lo contrario salen sin garantía con la boleta.\n\n¿Puedo ayudarte con algo más? 😊`;
  }

  // EFECTIVO / DESCUENTO
  if (texto.match(/(efectivo|descuento|haces descuento|aplicas descuento)/)) {
    return `¡Excelente! Te comento, tenemos beneficios exclusivos para pago en efectivo:\n- 3% off en compras de $150.000.\n- 5% off en compras de $250.000.\n\n¿Cuál es el monto total aproximado de tu compra para ver qué descuento te podemos aplicar?`;
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
    return `🛍️ *Perfumería & Fragancias:*\n• Toda la línea de *Saphirus* y Sahumerios *Vishnu*.\n• Gran variedad de *Perfumería Árabe* original (*Lattafa*, *Maison Alhambra*, etc.).\n\nEn el local podés sentir las fragancias. 👃\n\n¿Querés más info? Escribí *vendedor* o visitá nuestra tienda. https://concepciontecnologia.vercel.app/ 😊`;
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

  // RESPUESTA POR DEFECTO 
  // (Si el usuario escribió algo que no es búsqueda, ni saludo, ni matcheó con nada de arriba)
  return `😅 No entendí bien tu consulta.\n\nEscribí directamente el nombre del repuesto o producto que buscás, o escribí *vendedor* para hablar con una persona de nuestro equipo.`;
};

module.exports = { procesarMensaje };