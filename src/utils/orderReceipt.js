import { ORDER_TYPE_LABELS, PAYMENT_METHODS } from './constants';
import { wrapText } from './format';

/** 80mm ≈ 302px — ancho ticket térmico */
const THERMAL_MM = '80mm';
const THERMAL_PX = 302;
/**
 * Ventana compacta para el ticket.
 * Mín. ~420×560: el diálogo nativo de Chrome (Destino / Imprimir / Cancelar)
 * se recorta si la popup es más estrecha o baja (p. ej. 340×480).
 */
const WIN_WIDTH = 420;
const WIN_HEIGHT = 560;
const RECEIPT_RULE = '--------------------------------';
const RECEIPT_BULLET = '♦';
const ESCPOS_BULLET = '*';

function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(Number(km))) return '';
  return Number(km).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function brandTitle(orderTypeLabel) {
  return `${String(orderTypeLabel || 'Delivery').toUpperCase()} - POLLERÍA EL POLLÓN`;
}

export function paymentLabel(method) {
  const m = PAYMENT_METHODS.find((p) => p.id === method);
  return m?.label || (method === 'whatsapp' ? 'WhatsApp' : method || '—');
}

function formatTicketDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

function formatTicketTime(date) {
  return new Date(date).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getOrderReceiptMeta(order, branch) {
  const customer = order.customer || {};
  const items = order.items || [];
  const fechaBase = order.createdAt ? new Date(order.createdAt) : new Date();
  const ticket = String(order.ticketNumber || order.codigo_pedido || '001').padStart(6, '0');
  const subtotal = Number(order.subtotal) || items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const deliveryFee = Number(order.deliveryFee) || 0;
  const storedTotal = Number(order.total) || 0;
  const total = deliveryFee > 0
    ? Math.max(storedTotal, subtotal + deliveryFee)
    : (storedTotal || subtotal);

  return {
    ticket,
    ticketShort: ticket.replace(/^0+/, '') || ticket,
    fechaStr: formatTicketDate(fechaBase),
    horaStr: formatTicketTime(fechaBase),
    sucursal: branch?.name || 'Pollería El Pollón',
    sucursalCity: branch?.city || '',
    sucursalPhone: branch?.phone || '',
    orderType: (order.orderType || 'delivery').toLowerCase(),
    orderTypeLabel: ORDER_TYPE_LABELS[(order.orderType || 'delivery').toLowerCase()] || 'Delivery',
    customer,
    items,
    subtotal,
    deliveryFee,
    deliveryDistanceKm: order.deliveryDistanceKm != null ? Number(order.deliveryDistanceKm) : null,
    total,
    payment: paymentLabel(order.metodo_pago),
    estado: order.estado || 'pendiente',
  };
}

/** Líneas extra del ítem: bebidas, bolsa, notas */
function getItemExtraLines(item) {
  const lines = [];

  if (item.drinks?.length) {
    const list = item.drinks.filter(Boolean);
    if (list.length === 1) lines.push(list[0]);
    else list.forEach((d, i) => lines.push(`#${i + 1}: ${d}`));
  } else if (item.drink?.trim()) {
    const parts = item.drink.split(' · ').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1 && !/^#\d+:/.test(parts[0])) lines.push(parts[0]);
    else lines.push(...parts);
  }

  if (item.bagQty > 0) lines.push(`Bolsa x${item.bagQty}`);
  if (item.notes?.trim()) lines.push(item.notes.trim());

  return lines;
}

function formatMoneyPlain(n) {
  return `$${(Number(n) || 0).toLocaleString('es-CL')}`;
}

function buildDeliveryFooterLines(m, bullet = RECEIPT_BULLET) {
  if (m.orderType === 'delivery' && m.deliveryFee <= 0) {
    return [`${bullet} El delivery no está incluido en este total.`];
  }
  return [];
}

function padMoneyRow(label, amount, width = 32) {
  const money = formatMoneyPlain(amount);
  const gap = Math.max(1, width - label.length - money.length);
  return `${label}${' '.repeat(gap)}${money}`;
}

function buildTotalsPlain(m, bullet = RECEIPT_BULLET) {
  const lines = [RECEIPT_RULE];
  if (m.deliveryFee > 0) {
    lines.push(padMoneyRow('Subtotal', m.subtotal));
    const dist = m.deliveryDistanceKm != null ? ` (${formatDistanceKm(m.deliveryDistanceKm)} km)` : '';
    lines.push(padMoneyRow(`Delivery${dist}`, m.deliveryFee));
    lines.push(RECEIPT_RULE);
  }
  lines.push(padMoneyRow('TOTAL', m.total));
  lines.push(`Pago: ${String(m.payment || '').toUpperCase()}`);
  lines.push(...buildDeliveryFooterLines(m, bullet));
  return lines.join('\n');
}

function buildCustomerPlain(customer, bullet = RECEIPT_BULLET) {
  const lines = [];
  lines.push(`${bullet} Nombre: ${customer.name || '-'}`);
  lines.push(`${bullet} Teléfono: ${customer.phone || '-'}`);
  lines.push(`${bullet} Dirección:`);
  const addr = wrapText(customer.address || '-', 30);
  if (addr) {
    addr.split('\n').forEach((l) => lines.push(`  ${l}`));
  } else {
    lines.push('  -');
  }
  if (customer.reference?.trim()) {
    lines.push(`${bullet} Referencia:`);
    wrapText(customer.reference, 30).split('\n').forEach((l) => lines.push(`  ${l}`));
  }
  if (customer.comments?.trim()) {
    lines.push(`${bullet} Observaciones:`);
    wrapText(customer.comments, 30).split('\n').forEach((l) => lines.push(`  ${l}`));
  }
  return lines.join('\n');
}

function buildItemsPlain(items, bullet = RECEIPT_BULLET) {
  if (!items.length) return 'Sin productos';
  return items.map((it) => {
    const qty = it.qty ?? 1;
    const extras = getItemExtraLines(it).map((l) => `  ${l}`);
    const block = [
      `${bullet} ${qty}x ${it.name}`,
      ...extras,
      `  ${formatMoneyPlain(it.total || 0)}`,
      '',
    ];
    return block.join('\n');
  }).join('\n');
}

function buildReceiptCore(m, { customerBlock, itemsBlock, footerExtra = [], compact = false, bullet = RECEIPT_BULLET }) {
  const footer = [
    buildTotalsPlain(m, bullet),
    ...footerExtra,
  ].filter(Boolean).join('\n');

  const header = [
    brandTitle(m.orderTypeLabel),
    compact ? null : '',
    `CODIGO DE SEGUIMIENTO: ${m.ticket}`,
    `Pedido: ${m.ticket}  ${m.fechaStr}  ${m.horaStr}`,
    RECEIPT_RULE,
    'DATOS DEL CLIENTE',
    RECEIPT_RULE,
    compact ? null : '',
    customerBlock,
    compact ? null : '',
    RECEIPT_RULE,
    'DETALLE DEL PEDIDO',
    RECEIPT_RULE,
    compact ? null : '',
    itemsBlock,
    footer,
  ].filter((line) => line !== null);

  return header.join('\n');
}

/** Texto plano — impresión térmica y WhatsApp (mismo formato) */
export function buildOrderReceiptText(order, branch) {
  const m = getOrderReceiptMeta(order, branch);
  return buildReceiptCore(m, {
    customerBlock: buildCustomerPlain(m.customer),
    itemsBlock: buildItemsPlain(m.items),
  });
}

/** Texto ESC/POS por red — guiones ASCII, menos espacio arriba, acentos vía CP850 */
export function buildOrderReceiptTextEscPos(order, branch) {
  const m = getOrderReceiptMeta(order, branch);
  return buildReceiptCore(m, {
    customerBlock: buildCustomerPlain(m.customer, ESCPOS_BULLET),
    itemsBlock: buildItemsPlain(m.items, ESCPOS_BULLET),
    compact: true,
    bullet: ESCPOS_BULLET,
  });
}

/** Mensaje WhatsApp al cliente — confirmación de pedido recibido (admin) */
export function buildCustomerOrderConfirmationMessage(order, branch) {
  const m = getOrderReceiptMeta(order, branch);
  const receipt = buildOrderReceiptText(order, branch);
  const firstName = (m.customer.name || 'Cliente').trim().split(/\s+/)[0];

  return [
    `Hola ${firstName},`,
    '',
    `Somos ${m.sucursal} — Pollería El Pollón.`,
    '',
    `Tu pedido N° ${m.ticketShort} fue recibido correctamente. Te enviamos el detalle:`,
    '',
    receipt,
    '',
    'Por favor, confírmanos que todo está correcto respondiendo a este mensaje.',
    '',
    '¡Gracias por tu preferencia!',
  ].join('\n');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ruleHtml() {
  return `<div class="hr" aria-hidden="true"></div>`;
}

function formatMoneyTicket(n) {
  return `$ ${(Number(n) || 0).toLocaleString('es-CL')}`;
}

function up(str) {
  return String(str ?? '').toLocaleUpperCase('es-CL');
}

function buildCustomerHtml(customer) {
  const bullet = RECEIPT_BULLET;
  const name = esc(up(customer.name || '-'));
  const phone = esc(customer.phone || '-');
  const addr = esc(up(customer.address || '-'));
  const ref = (customer.reference || '').trim();
  const obs = (customer.comments || '').trim();

  const refBlock = ref
    ? `<div class="row">
    <span class="b">${bullet}</span>
    <span class="row-body">
      <span class="lbl">REFERENCIA:</span>
      <span class="val"> ${esc(up(ref))}</span>
    </span>
  </div>`
    : '';

  const obsBlock = obs
    ? `<div class="row">
    <span class="b">${bullet}</span>
    <span class="row-body">
      <span class="lbl">OBSERVACIONES:</span>
      <span class="val"> ${esc(up(obs))}</span>
    </span>
  </div>`
    : '';

  return `
  <div class="row">
    <span class="b">${bullet}</span>
    <span class="row-body"><span class="lbl">NOMBRE:</span> <span class="val">${name}</span></span>
  </div>
  <div class="row">
    <span class="b">${bullet}</span>
    <span class="row-body"><span class="lbl">TELÉFONO:</span> <span class="val">${phone}</span></span>
  </div>
  <div class="row">
    <span class="b">${bullet}</span>
    <span class="row-body"><span class="lbl">DIRECCIÓN:</span> <span class="val"> ${addr}</span></span>
  </div>
  ${refBlock}
  ${obsBlock}`;
}

function buildItemsHtml(items) {
  if (!items.length) return '<div class="val">SIN PRODUCTOS</div>';
  const bullet = RECEIPT_BULLET;

  return items.map((it) => {
    const qty = it.qty ?? 1;
    const extras = getItemExtraLines(it)
      .map((line) => `<div class="extra">${esc(line.replace(/x(\d+)/gi, '×$1'))}</div>`)
      .join('');
    return `
    <div class="item">
      <div class="row">
        <span class="b">${bullet}</span>
        <span class="row-body"><span class="item-name">${qty}× ${esc(it.name)}</span></span>
      </div>
      ${extras}
      <div class="price">${formatMoneyTicket(it.total || 0)}</div>
    </div>`;
  }).join('');
}

function buildFooterHtml(m) {
  const deliveryNote = buildDeliveryFooterLines(m)
    .map((line) => `<div class="note">${esc(line)}</div>`)
    .join('');

  const distLabel = m.deliveryDistanceKm != null
    ? `Delivery ( ${Number(m.deliveryDistanceKm).toFixed(1)} km. )`
    : 'Delivery';

  const mid = m.deliveryFee > 0
    ? `<div class="money">
    <span class="money-lbl">Subtotal</span><span class="money-amt">${formatMoneyTicket(m.subtotal)}</span>
  </div>
  <div class="money">
    <span class="money-lbl">${esc(distLabel)}</span><span class="money-amt">${formatMoneyTicket(m.deliveryFee)}</span>
  </div>
  ${ruleHtml()}`
    : '';

  const pay = String(m.payment || 'Transferencia');
  const payNice = pay.charAt(0).toUpperCase() + pay.slice(1).toLowerCase();

  return `
  ${ruleHtml()}
  ${mid}
  <div class="money money--total">
    <span>TOTAL:</span><span>${formatMoneyTicket(m.total)}</span>
  </div>
  <div class="pago"><span class="pago-lbl">PAGO:</span> <span class="pago-val">${esc(payNice)}</span></div>
  ${deliveryNote}`;
}

/** HTML ticket 80mm — mockup final: sans nítida, mayúsculas, guiones */
export function buildThermalReceiptHtml(order, branch) {
  const m = getOrderReceiptMeta(order, branch);
  const { customer, items } = m;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${THERMAL_PX}"/>
<title>Pedido ${esc(m.ticket)}</title>
<style>
  @page { size: ${THERMAL_MM} auto; margin: 0; }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: none !important;
    -moz-osx-font-smoothing: unset !important;
    font-smooth: never !important;
  }
  html {
    width: ${THERMAL_MM};
    max-width: ${THERMAL_MM};
    min-width: ${THERMAL_MM};
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    width: ${THERMAL_MM};
    max-width: ${THERMAL_MM};
    min-width: ${THERMAL_MM};
    margin: 0 auto;
    padding: 0;
    overflow-x: hidden;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.48;
    font-weight: 400;
    text-rendering: geometricPrecision;
  }
  .ticket {
    width: 100%;
    padding: 6px 8px 15mm;
  }
  .feed-top { height: 8mm; }

  .title {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 14px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.25;
    margin: 0 0 9px;
    color: #000;
  }

  .track {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 12.5px;
    text-align: left;
    text-transform: uppercase;
    line-height: 1.3;
    margin: 0 0 5px;
    color: #000;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    font-weight: 400;
    color: #000;
    margin: 0 0 2px;
    white-space: nowrap;
  }

  .hr {
    display: block;
    width: 100%;
    margin: 10px 0;
    border: 0;
    border-top: 2px dashed #000;
    height: 0;
  }

  .section {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 13px;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    line-height: 1.3;
    color: #000;
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin: 5px 0;
  }
  .b {
    flex: 0 0 auto;
    font-weight: 700;
    font-size: 12px;
    color: #000;
    line-height: 1.48;
  }
  .row-body {
    flex: 1 1 auto;
    min-width: 0;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .lbl {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 12.5px;
    text-transform: uppercase;
    color: #000;
  }
  .val {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 400;
    font-size: 12.5px;
    text-transform: uppercase;
    color: #000;
    letter-spacing: 0.03em;
  }

  .item { margin: 6px 0 9px; }
  .item-name {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: #000;
  }
  .extra {
    margin: 2px 0 1px 1.15em;
    padding-left: 4px;
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 400;
    font-size: 12px;
    color: #000;
  }
  .price {
    margin: 4px 0 0 1.15em;
    padding-left: 4px;
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 13.5px;
    color: #000;
  }

  .money {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 4px 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #000;
  }
  .money-lbl { font-weight: 400; }
  .money-amt { font-weight: 700; }
  .money--total {
    font-weight: 700;
    font-size: 15px;
    margin: 8px 0 4px;
  }
  .pago {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    color: #000;
    margin-bottom: 0;
  }
  .pago-lbl {
    font-weight: 700;
    text-transform: uppercase;
  }
  .pago-val { font-weight: 400; }
  .note {
    margin-top: 6px;
    font-size: 12px;
    font-weight: 400;
    color: #000;
  }

  @media screen {
    html { background: #ececec; }
    body { box-shadow: 0 4px 24px rgba(0,0,0,.18); }
  }
  @media print {
    @page { size: ${THERMAL_MM} auto; margin: 0; }
    html, body {
      width: ${THERMAL_MM} !important;
      max-width: ${THERMAL_MM} !important;
      min-width: ${THERMAL_MM} !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      box-shadow: none !important;
      overflow: hidden !important;
      -webkit-font-smoothing: none !important;
      font-smooth: never !important;
    }
    * {
      -webkit-font-smoothing: none !important;
      font-smooth: never !important;
      color: #000 !important;
    }
    .ticket {
      padding: 8mm 6px 15mm !important;
      margin: 0 !important;
    }
    .hr {
      width: 100% !important;
      margin: 10px 0 !important;
      border-top: 2px dashed #000 !important;
    }
    .feed-top { height: 10mm !important; }
    .feed-bot { display: none !important; height: 0 !important; min-height: 0 !important; }
  }
</style>
</head>
<body>
<div class="ticket">
  <div class="feed-top" aria-hidden="true"></div>
  <div class="title">${esc(brandTitle(m.orderTypeLabel))}</div>
  <div class="track">CODIGO DE SEGUIMIENTO: ${esc(m.ticket)}</div>
  <div class="meta">
    <span>Pedido: ${esc(m.ticket)}</span>
    <span>${esc(m.fechaStr)}</span>
    <span>${esc(m.horaStr)}</span>
  </div>

  ${ruleHtml()}
  <div class="section">DATOS DEL CLIENTE</div>
  ${ruleHtml()}

  ${buildCustomerHtml(customer)}

  ${ruleHtml()}
  <div class="section">DETALLE DEL PEDIDO</div>
  ${ruleHtml()}

  ${buildItemsHtml(items)}
  ${buildFooterHtml(m)}
  <div class="feed-bot" aria-hidden="true"></div>
</div>
<script>
  function clampTicketPrintHeight() {
    var ticket = document.querySelector('.ticket');
    if (!ticket) return;
    var h = Math.ceil(ticket.getBoundingClientRect().height);
    document.documentElement.style.height = h + 'px';
    document.body.style.height = h + 'px';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  window.addEventListener('beforeprint', clampTicketPrintHeight);
  window.addEventListener('afterprint', function () {
    setTimeout(function () { try { window.close(); } catch (e) {} }, 150);
  });
</script>
</body>
</html>`;
}


let printWinRef = null;

/** Imprime ticket 80mm en ventana compacta (tamaño rollo térmico) */
export function printThermalReceipt(order, branch) {
  if (!order) throw new Error('Pedido no válido');
  const html = buildThermalReceiptHtml(order, branch);
  openCompactPrintWindow(html);
}

function openCompactPrintWindow(html) {
  if (printWinRef && !printWinRef.closed) {
    try {
      printWinRef.close();
    } catch {
      /* ignore */
    }
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const left = Math.max(0, Math.round((window.screen.width - WIN_WIDTH) / 2));
  const top = Math.max(0, 40);
  const features = [
    `width=${WIN_WIDTH}`,
    `height=${WIN_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  const win = window.open(url, 'pollon_ticket_print', features);

  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Permite ventanas emergentes para imprimir el ticket');
  }

  printWinRef = win;

  const closePrintWindow = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        if (win && !win.closed) win.close();
      } catch {
        /* ignore */
      }
      if (printWinRef === win) printWinRef = null;
    }, 150);
  };

  const fitWindowToTicket = () => {
    try {
      const doc = win.document;
      const contentH = Math.max(
        doc.body?.scrollHeight || 0,
        doc.documentElement?.scrollHeight || 0,
        WIN_HEIGHT - 40,
      );
      const chromePad = Math.max(0, (win.outerHeight || 0) - (win.innerHeight || 0));
      // Altura mínima para que el pie del diálogo (Imprimir / Cancelar) no quede cortado
      const targetH = Math.min(Math.max(contentH + chromePad + 24, WIN_HEIGHT), 720);
      win.resizeTo(WIN_WIDTH, targetH);
    } catch {
      win.resizeTo(WIN_WIDTH, WIN_HEIGHT);
    }
  };

  let printed = false;
  const runPrint = () => {
    if (printed || win.closed) return;
    printed = true;
    fitWindowToTicket();

    try {
      win.addEventListener('afterprint', closePrintWindow);
      win.onafterprint = closePrintWindow;
    } catch {
      /* ignore */
    }

    setTimeout(() => {
      if (win.closed) return;
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.warn('[Pollón] print:', e);
        closePrintWindow();
      }
    }, 450);
  };

  win.addEventListener('load', runPrint);
  setTimeout(runPrint, 900);
}
