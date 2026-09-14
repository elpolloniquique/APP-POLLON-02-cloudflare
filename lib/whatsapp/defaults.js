/** Plantillas, tramos de fidelización y keywords por defecto — WhatsApp Inteligente */

export const DEFAULT_LINK_WEB = 'https://www.el-pollon.cl/';

export const DEFAULT_COMPLAINT_KEYWORDS = [
  'reclamo', 'queja', 'malo', 'mala', 'fría', 'fria', 'frío', 'frio',
  'crudo', 'demora', 'tarde', 'horrible', 'asco', 'nunca más', 'nunca mas',
  'estafa', 'mal servicio', 'no llegó', 'no llego', 'faltó', 'falto',
  'pelo', 'sucio', 'sucia', 'indignado', 'indignada', 'pésimo', 'pesimo',
  'vomito', 'vómito', 'envenen', 'roto', 'quemado',
];

export const DEFAULT_LOYALTY_TIERS = [
  { n: 1, text: 'Qué gusto atenderte.' },
  { n: 2, text: 'Qué alegría tenerte de nuevo.' },
  { n: 3, text: 'Gracias por tu tercera compra con nosotros, se agradece de verdad.' },
  { n: 5, text: 'Ya eres de la casa en {sucursal}. ¡Gracias por volver!' },
  { n: 10, text: 'Diez pedidos con nosotros en {sucursal}: eres de la familia Pollón. 🙏' },
];

export const DEFAULT_TEMPLATES = {
  bienvenida: `Hola{, {nombre}} 👋 te habla *Pollería El Pollón — {sucursal}*.
{estado_atencion}
{agradecimiento_fidelidad}

Te invitamos a hacer tu pedido en nuestra web, es más rápido y queda registrado al tiro:
{link_web}

1) Selecciona tu sucursal
2) Elige tus platos y agrégalos al carrito
3) Confirma tu pedido

Cuando quede registrado, te avisamos aquí cada avance (cocina, reparto y entrega).
¿Te ayudo con el menú, un plato o el horario?`,

  como_comprar: `Pedir en *Pollería El Pollón — {sucursal}* es fácil:

1) Entra a {link_web}
2) Elige tu sucursal
3) Arma tu pedido en la tienda: {link_tienda}
4) Confirma en el checkout (pagas *al recibir*, con el método de tu sucursal)

Si ya tienes un pedido, escríbeme el código (#000123) y te digo el estado.
¿Quieres que te pase el menú o un plato en particular?`,

  confirmacion_pedido: `Hola {nombre}, te habla *Pollería El Pollón — {sucursal}*.
{agradecimiento_fidelidad}
Tu pedido *#{codigo}* fue recepcionado correctamente y *ya está visible en sucursal*. ✅

{detalle}
*Total: {total}* · {tipo} · {pago}

Te avisaremos cuando cambie de estado. ¡Gracias por preferirnos!`,

  estado_cocina: `{nombre}, tu pedido *#{codigo}* ya está *en cocina*, preparándose con cariño. 🍗`,

  estado_reparto: `{nombre}, tu pedido *#{codigo}* ya va *en camino*, en reparto a tu destino. 🛵
Tiempo estimado: {eta}`,

  estado_entregado: `¡Gracias por tu compra, {nombre}! 🙏
En *Pollería El Pollón — {sucursal}* fue un gusto atenderte.
{agradecimiento_fidelidad}
Que lo disfrutes. Cuando quieras, aquí estamos.`,

  estado_cancelado: `{nombre}, tu pedido *#{codigo}* fue cancelado.
Si fue un error o necesitas ayuda, escribe y te atiende un encargado de {sucursal}.`,

  queja_cliente: `Lamento mucho lo ocurrido{, {nombre}}. 🙏
Un encargado de *{sucursal}* te va a responder enseguida.
Gracias por avisarnos: nos ayuda a mejorar.`,

  fallback: `Puedo ayudarte con el *menú*, *precios*, *horario*, *cómo pedir* en la web o el *estado de tu pedido*.
También puedo pasarte con una persona de {sucursal}. ¿Qué prefieres?`,

  sucursal_info: `*{sucursal}* ({ciudad})
📍 {direccion_local}
📞 {telefono_local}
🕐 {horario}
{estado_atencion}

Delivery: {delivery_flag} · ETA {eta}
Retiro: {retiro_flag} · Reserva: {reserva_flag}

Pide en la web: {link_tienda}`,

  menu_listado: `Menú de *{sucursal}* (disponible ahora):

{menu_resumen}

Ver todo y pedir: {link_tienda}

Dime un plato y te paso el precio exacto.`,

  plato: `{plato_detalle}

Pídelo en la web: {link_plato}`,

  horario: `{estado_atencion}
Horario de *{sucursal}*: {horario}

Puedes ver el menú igual en {link_tienda}`,

  delivery_info: `Delivery en *{sucursal}*: {delivery_flag}
Tiempo estimado: {eta}
{delivery_cost_txt}

El costo exacto se calcula en el checkout según tu dirección (no inventamos tarifas aquí).
Pide en: {link_tienda}`,

  bestsellers: `Lo más pedido esta semana en *{sucursal}*:

{bestsellers_txt}

Ver en la tienda: {link_tienda}`,

  estado_pedido: `{nombre}, tu pedido *#{codigo}* está: *{estado_humano}*.
{detalle_corto}

Seguir en la web: {link_seguimiento}`,

  bienvenida_b: `Hola{, {nombre}} 👋 *Pollería El Pollón — {sucursal}* al habla.
{estado_atencion}
{agradecimiento_fidelidad}

El pedido más rápido es por la web (queda registrado al tiro):
{link_tienda}

Cuando confirmes, te avisamos aquí: cocina → reparto → entrega.
¿Menú, un plato o el horario?`,

  opt_out: `Listo{, {nombre}}. Quedas fuera de mensajes promocionales de *{sucursal}* por WhatsApp.
Si tienes un pedido en curso, los avisos de cocina/reparto sí te llegan.
Para un pedido o una persona, escríbenos cuando quieras.`,
};

export const DEFAULT_SETTINGS_FLAGS = {
  enabled: false,
  modo_proactivo: false,
  avisos_en_modo_humano: true,
  enviar_foto_plato: false,
  ab_welcome_enabled: false,
  avisos_si_opt_out: true,
  ollama_enabled: false,
  ollama_model: 'llama3.2',
  usar_horario_sucursal: true,
  bot_24_7: false,
  bot_from: null,
  bot_to: null,
  human_timeout_min: 120,
  contar_compras_solo_sucursal: true,
  lookback_hours: 48,
  rate_limit_per_min: 4,
  link_web: DEFAULT_LINK_WEB,
};

export const HUMAN_KEYWORDS = [
  'cajero', 'cajera', 'persona', 'hablar con alguien', 'encargado', 'encargada',
  'humano', 'operador', 'operadora', 'atendente', 'jefe', 'dueño', 'dueno',
  'hablar con una persona', 'pasame con alguien', 'pásame con alguien',
];

export const GREETING_KEYWORDS = [
  'hola', 'holi', 'holaa', 'buenas', 'buen dia', 'buen día', 'buenos dias',
  'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello',
  'que tal', 'qué tal', 'saludos', 'ola',
];

export const HOW_TO_BUY_KEYWORDS = [
  'como pido', 'cómo pido', 'como comprar', 'cómo comprar', 'como hago un pedido',
  'cómo hago un pedido', 'quiero pedir', 'quiero hacer un pedido', 'hacer un pedido',
  'pagina web', 'página web', 'pagina', 'web', 'carrito', 'checkout', 'como se pide',
];

export const HOURS_KEYWORDS = [
  'atienden', 'abierto', 'abierta', 'cerrado', 'cerrada', 'horario', 'hora',
  'hasta que hora', 'hasta qué hora', 'abren', 'cierran', 'estan abiertos',
  'están abiertos', 'trabajan hoy',
];

export const BRANCH_KEYWORDS = [
  'direccion', 'dirección', 'donde quedan', 'dónde quedan', 'donde estan',
  'dónde están', 'ubicacion', 'ubicación', 'telefono', 'teléfono', 'sucursal',
  'local', 'mapa',
];

export const DELIVERY_KEYWORDS = [
  'delivery', 'despacho', 'envio', 'envío', 'reparto', 'minimo', 'mínimo',
  'cuanto demora', 'cuánto demora', 'eta', 'llega', 'hasta donde llegan',
  'hasta dónde llegan', 'costo de envio', 'costo de envío', 'cuanto sale el delivery',
  'cuánto sale el delivery', 'retiro', 'reserva',
];

export const MENU_KEYWORDS = [
  'menu', 'menú', 'carta', 'platos', 'que tienen', 'qué tienen', 'ofertas',
  'promos', 'promociones', 'combos', 'que venden', 'qué venden',
];

export const BESTSELLER_KEYWORDS = [
  'mas vendido', 'más vendido', 'popular', 'recomendado', 'recomienda',
  'que me recomiendas', 'qué me recomiendas', 'favorito', 'top',
];

export const ORDER_STATUS_KEYWORDS = [
  'estado', 'pedido', 'seguimiento', 'donde esta mi pedido', 'dónde está mi pedido',
  'ya esta listo', 'ya está listo', 'mi pedido', 'codigo', 'código',
];

export const AVISOS_KEYWORDS = [
  'avisos', 'quiero avisos', 'activar avisos', 'notificaciones', 'avisenme',
  'avísame', 'avisame',
];

export const OPT_OUT_KEYWORDS = [
  'no me escriban', 'no me escribas', 'stop', 'baja', 'darme de baja',
  'no mas promociones', 'no más promociones', 'no mas avisos', 'no más avisos',
  'no quiero mensajes', 'unsubscribe', 'cancelar avisos',
];
