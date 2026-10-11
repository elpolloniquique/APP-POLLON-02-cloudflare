import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RED = rgb(0.753, 0, 0);
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.35, 0.35, 0.35);
const SOFT = rgb(0.965, 0.957, 0.945);
const LINE = rgb(0.9, 0.9, 0.9);
const GREEN = rgb(0.086, 0.396, 0.204);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.067, 0.067, 0.067);
const CREAM = rgb(0.91, 0.937, 0.89);
const WARN = rgb(1, 0.969, 0.929);
const WARN_LINE = rgb(0.996, 0.843, 0.667);
const WARN_INK = rgb(0.486, 0.176, 0.071);
const A4 = { w: 595.28, h: 841.89 };
const M = 36;

function loadFontBytes(names) {
  for (const name of names) {
    try { return readFileSync(join('C:/Windows/Fonts', name)); } catch { /* next */ }
  }
  return null;
}

const draw = {
  text(page, font, text, x, y, size, color = INK) {
    page.drawText(text, { x, y, size, font, color });
  },
};

function wrap(font, text, size, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  const fit = (word) => {
    if (font.widthOfTextAtSize(word, size) <= maxW) return [word];
    const parts = [];
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (font.widthOfTextAtSize(next, size) <= maxW) chunk = next;
      else {
        if (chunk) parts.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  };
  for (const word of words) {
    for (const piece of fit(word)) {
      const next = line ? `${line} ${piece}` : piece;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else {
        if (line) lines.push(line);
        line = piece;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function header(page, font, bold, kicker, title, subtitle, chip) {
  draw.text(page, bold, kicker, M, A4.h - 42, 9, RED);
  draw.text(page, bold, title, M, A4.h - 68, 20, INK);
  draw.text(page, font, subtitle, M, A4.h - 86, 10, MUTED);
  page.drawRectangle({ x: M, y: A4.h - 98, width: A4.w - M * 2, height: 3, color: RED });
  const chipW = bold.widthOfTextAtSize(chip, 8) + 16;
  page.drawRectangle({ x: A4.w - M - chipW, y: A4.h - 50, width: chipW, height: 18, color: BLACK, borderRadius: 9 });
  draw.text(page, bold, chip, A4.w - M - chipW + 8, A4.h - 45, 8, WHITE);
}

function footer(page, font, bold, left, right) {
  page.drawRectangle({ x: M, y: 28, width: A4.w - M * 2, height: 0.6, color: LINE });
  draw.text(page, font, left, M, 16, 8, MUTED);
  const rw = bold.widthOfTextAtSize(right, 8);
  draw.text(page, bold, right, A4.w - M - rw, 16, 8, INK);
}

function section(page, bold, title, y) {
  draw.text(page, bold, title.toUpperCase(), M, y, 10, RED);
  return y - 18;
}

function step(page, font, bold, num, title, body, y, maxW = A4.w - M * 2 - 36) {
  page.drawCircle({ x: M + 10, y: y + 4, size: 10, color: RED });
  const nw = bold.widthOfTextAtSize(String(num), 10);
  draw.text(page, bold, String(num), M + 10 - nw / 2, y, 10, WHITE);
  draw.text(page, bold, title, M + 30, y, 12, INK);
  let yy = y - 15;
  for (const line of wrap(font, body, 10.5, maxW)) {
    draw.text(page, font, line, M + 30, yy, 10.5, rgb(0.15, 0.15, 0.15));
    yy -= 13;
  }
  return yy - 8;
}

function node(page, bold, font, x, y, w, h, bg, title, sub, ink = WHITE) {
  page.drawRectangle({ x, y, width: w, height: h, color: bg, borderRadius: 8 });
  const tw = bold.widthOfTextAtSize(title, 10);
  draw.text(page, bold, title, x + (w - tw) / 2, y + 28, 10, ink);
  const sw = font.widthOfTextAtSize(sub, 8);
  draw.text(page, font, sub, x + (w - sw) / 2, y + 14, 8, ink);
}

function noteBox(page, font, bold, y, line1, line2) {
  page.drawRectangle({
    x: M, y, width: A4.w - M * 2, height: 42,
    color: WARN, borderColor: WARN_LINE, borderWidth: 1, borderRadius: 7,
  });
  draw.text(page, bold, 'Importante', M + 10, y + 26, 10, WARN_INK);
  draw.text(page, font, line1, M + 10, y + 12, 10, WARN_INK);
  draw.text(page, font, line2, M + 10, y - 1, 10, WARN_INK);
}

function saveCopies(bytes, names) {
  mkdirSync(join(root, 'public', 'DESCARGAR-APK'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  const publicPath = join(root, 'public', names.public);
  writeFileSync(publicPath, bytes);
  for (const extra of names.copies) copyFileSync(publicPath, join(root, extra));
  console.log(`OK ${names.public} · ${bytes.length} bytes · 2 páginas`);
}

async function fonts() {
  const regularBytes = loadFontBytes(['arial.ttf', 'ARIAL.TTF', 'calibri.ttf', 'Calibri.ttf']);
  const boldBytes = loadFontBytes(['arialbd.ttf', 'ARIALBD.TTF', 'calibrib.ttf', 'Calibri-Bold.ttf']);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = regularBytes
    ? await pdf.embedFont(regularBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);
  const bold = boldBytes
    ? await pdf.embedFont(boldBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, font, bold };
}

function drawFlow(page, font, bold, labels) {
  const nw = 108;
  const nh = 50;
  const gap = 18;
  const total = nw * 4 + gap * 3;
  let x = (A4.w - total) / 2;
  const ny = A4.h - 168;
  labels.forEach((item, i) => {
    if (item.outline) {
      page.drawRectangle({ x, y: ny, width: nw, height: nh, color: WHITE, borderColor: RED, borderWidth: 2, borderRadius: 8 });
      let tw = bold.widthOfTextAtSize(item.title, 9);
      draw.text(page, bold, item.title, x + (nw - tw) / 2, ny + 28, 9, INK);
      tw = font.widthOfTextAtSize(item.sub, 8);
      draw.text(page, font, item.sub, x + (nw - tw) / 2, ny + 14, 8, MUTED);
    } else {
      node(page, bold, font, x, ny, nw, nh, item.bg, item.title, item.sub);
    }
    if (i < labels.length - 1) draw.text(page, bold, '→', x + nw + 3, ny + 18, 14, RED);
    x += nw + gap;
  });
  return ny;
}

async function buildJefe() {
  const { pdf, font, bold } = await fonts();
  const p1 = pdf.addPage([A4.w, A4.h]);
  header(p1, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Cómo instalar y entrar', 'Hoja 1 de 2  ·  App 1.6.0  ·  Un solo correo para todo', 'No uses la 1.5.0');
  let y = section(p1, bold, 'Instalar la app 1.6.0', A4.h - 122);
  y = step(p1, font, bold, 1, 'Baja la app en tu celular',
    'Por Wi-Fi abre: www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk', y);
  y = step(p1, font, bold, 2, 'Si dice “no se puede instalar”',
    'Toca Configuración y activa Permitir de esta fuente. Vuelve y toca Instalar.', y);
  y = step(p1, font, bold, 3, 'Abre El Pollón',
    'Usa el icono El Pollón. Si ya tenías la 1.5.0, instala encima esta 1.6.0. La vieja no deja entrar al jefe.', y);
  y = section(p1, bold, 'Entrar', y - 4);
  y = step(p1, font, bold, 4, 'Entra con tu correo de jefe',
    'El mismo que te creó el super admin. Con ese correo entras a la app y al pollito.', y);
  y = step(p1, font, bold, 5, 'Toca Permitir avisos, GPS y entrar',
    'Notificaciones: Permitir. Ubicación: Siempre. Ubicación precisa: Sí.', y);
  y = step(p1, font, bold, 6, 'Deja la app así en Ajustes',
    'Ajustes → Apps → El Pollón. Notificaciones ON. Ubicación Siempre. Batería Sin restricciones. Autostart ON.', y);

  const boxH = 88;
  const boxW = (A4.w - M * 2 - 10) / 2;
  const boxY = y - boxH - 6;
  p1.drawRectangle({ x: M, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  p1.drawRectangle({ x: M + boxW + 10, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  draw.text(p1, bold, 'Puerta 1 · App nativa', M + 10, boxY + boxH - 18, 11, INK);
  wrap(font, 'En el celular. Ves pedidos nuevos, aceptas, recoges y entregas. Tú no necesitas que te asignen.', 10, boxW - 20)
    .forEach((ln, i) => draw.text(p1, font, ln, M + 10, boxY + boxH - 36 - i * 13, 10, INK));
  draw.text(p1, bold, 'Puerta 2 · Pollito', M + boxW + 20, boxY + boxH - 18, 11, INK);
  wrap(font, 'En www.el-pollon.cl → Mi flota. Ahí creas motos y les asignas pedidos.', 10, boxW - 20)
    .forEach((ln, i) => draw.text(p1, font, ln, M + boxW + 20, boxY + boxH - 36 - i * 13, 10, INK));

  noteBox(p1, font, bold, boxY - 54,
    'Si la app dice “solo para repartidores”, no es tu correo: es la APK vieja.',
    'Instala la 1.6.0 y entra de nuevo con el mismo correo de jefe.');
  footer(p1, font, bold, 'Mismo correo en la app y en el pollito. No uses Chrome para aceptar.', 'Sigue en la hoja 2 →');

  const p2 = pdf.addPage([A4.w, A4.h]);
  header(p2, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Cómo trabajar y asignar', 'Hoja 2 de 2  ·  App nativa + pollito', 'Tú ves todos los nuevos');
  const ny = drawFlow(p2, font, bold, [
    { bg: BLACK, title: 'En línea', sub: 'app nativa' },
    { bg: RED, title: 'Pedido nuevo', sub: 'te llega a ti' },
    { outline: true, title: 'Aceptar o asignar', sub: 'tú o una moto' },
    { bg: GREEN, title: 'Entregado', sub: 'en la casa' },
  ]);
  y = section(p2, bold, 'Si lo llevas tú (app nativa)', ny - 22);
  y = step(p2, font, bold, 1, 'Arriba toca En línea',
    'Los pedidos nuevos de tu sucursal te aparecen solos. No te los tienes que asignar.', y);
  y = step(p2, font, bold, 2, 'Toca Aceptar',
    'Así te lo quedas. La moto no lo ve. Si no puedes, Rechazar.', y);
  y = step(p2, font, bold, 3, 'Sucursal → casa',
    'Navegar a sucursal → Pedido recogido → Navegar al cliente → Entregado.', y);
  y = section(p2, bold, 'Si lo lleva una moto (pollito)', y - 2);
  y = step(p2, font, bold, 4, 'Entra a www.el-pollon.cl con el mismo correo',
    'Vas a Mi flota. En el celular hay botón Atrás en cada pantalla.', y);
  y = step(p2, font, bold, 5, 'Crea motos con + Moto',
    'Nombre + correo + clave. Cada moto entra a la app con su propio correo.', y);
  y = step(p2, font, bold, 6, 'Toca Asignar moto',
    'Elige a quién. Esa moto lo ve en su app. El primero que asigne o acepte se lo queda. Tú no ves mapa en vivo.', y);

  y = section(p2, bold, 'Si algo falla', y - 4);
  const fails = [
    ['Dice “solo para repartidores”.', 'Instala la APK 1.6.0. La 1.5.0 no sirve para el jefe.'],
    ['No me llegan pedidos.', 'En la app: En línea ON. GPS Siempre.'],
    ['No puedo volver atrás.', 'En Mi flota usa el botón Atrás de cada pantalla.'],
    ['La moto no ve el pedido.', 'Asígnaselo en el pollito. Sin eso no le llega.'],
  ];
  fails.forEach(([t, d]) => {
    draw.text(p2, bold, t, M, y, 10, INK);
    wrap(font, d, 10, A4.w - M * 2 - 200).forEach((ln, i) => {
      draw.text(p2, font, ln, M + 200, y - i * 12, 10, rgb(0.2, 0.2, 0.2));
    });
    y -= 16;
  });
  footer(p2, font, bold, 'Guía jefe 1.6.0  ·  Pásala por WhatsApp', 'www.el-pollon.cl/guia-jefe-repartidores.pdf');

  const bytes = await pdf.save();
  saveCopies(bytes, {
    public: 'guia-jefe-repartidores.pdf',
    copies: [
      'docs/Guia-jefe-repartidores-El-Pollon.pdf',
      'public/DESCARGAR-APK/Guia-jefe-repartidores-El-Pollon.pdf',
    ],
  });
}

async function buildFlota() {
  const { pdf, font, bold } = await fonts();
  const p1 = pdf.addPage([A4.w, A4.h]);
  header(p1, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Cómo instalar y usar la app', 'Hoja 1 de 2  ·  Se hace una sola vez  ·  Android', 'App El Pollón');
  let y = section(p1, bold, 'Instalar', A4.h - 122);
  y = step(p1, font, bold, 1, 'Baja la app en el celular',
    'Abre este enlace por Wi-Fi: www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk', y);
  y = step(p1, font, bold, 2, 'Si dice “no se puede instalar”',
    'Toca Configuración y activa Permitir de esta fuente. Vuelve y toca Instalar.', y);
  y = step(p1, font, bold, 3, 'Abre El Pollón',
    'Usa el icono El Pollón. El pollito de Chrome solo avisa. Aceptar y entregar es en esta app.', y);
  y = section(p1, bold, 'Entrar y configurar', y - 4);
  y = step(p1, font, bold, 4, 'Entra con tu correo de moto',
    'Correo y contraseña que te dio tu jefe de flota. No uses el correo del jefe. Cada moto tiene el suyo.', y);
  y = step(p1, font, bold, 5, 'Toca Permitir avisos, GPS y entrar',
    'Notificaciones: Permitir. Ubicación: Siempre. Ubicación precisa: Sí. Nunca elijas Solo esta vez.', y);
  y = step(p1, font, bold, 6, 'Deja la app así en Ajustes del celular',
    'Ajustes → Apps → El Pollón. Notificaciones ON. Ubicación Siempre. Batería Sin restricciones. Autostart ON.', y);

  const boxH = 108;
  const boxW = (A4.w - M * 2 - 10) / 2;
  const boxY = y - boxH - 4;
  p1.drawRectangle({ x: M, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  p1.drawRectangle({ x: M + boxW + 10, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  draw.text(p1, bold, 'Xiaomi / Redmi / POCO', M + 10, boxY + boxH - 18, 11, INK);
  draw.text(p1, font, '1. Autostart / Inicio automático: ON', M + 10, boxY + boxH - 36, 10, INK);
  draw.text(p1, font, '2. Batería: Sin restricciones', M + 10, boxY + boxH - 50, 10, INK);
  draw.text(p1, font, '3. En recientes, pon candado.', M + 10, boxY + boxH - 64, 10, INK);
  draw.text(p1, font, '   No la deslices para cerrar.', M + 10, boxY + boxH - 78, 10, INK);
  draw.text(p1, bold, 'Samsung / otras', M + boxW + 20, boxY + boxH - 18, 11, INK);
  draw.text(p1, font, '1. Batería de El Pollón: Sin restricciones', M + boxW + 20, boxY + boxH - 36, 10, INK);
  draw.text(p1, font, '2. No la pongas en Reposo', M + boxW + 20, boxY + boxH - 50, 10, INK);
  draw.text(p1, font, '3. Datos en segundo plano: ON', M + boxW + 20, boxY + boxH - 64, 10, INK);
  noteBox(p1, font, bold, boxY - 54,
    'No te llegan todos los pedidos del local. Solo ves el que tu jefe te asigna.',
    'Si no te llega nada, pídele que te lo asigne. Pide a tu jefe: correo, clave y sucursal.');
  footer(p1, font, bold, 'Pide a tu jefe: correo, contraseña y sucursal.', 'Sigue en la hoja 2 →');

  const p2 = pdf.addPage([A4.w, A4.h]);
  header(p2, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Cómo trabajar un pedido', 'Hoja 2 de 2  ·  Primero te lo asigna el jefe', 'Haz esto, luego esto');
  const ny = drawFlow(p2, font, bold, [
    { bg: BLACK, title: 'En línea', sub: 'esperando' },
    { bg: RED, title: 'Te asignan', sub: 'tu jefe' },
    { outline: true, title: 'Pedido recogido', sub: 'en el local' },
    { bg: GREEN, title: 'Entregado', sub: 'en la casa' },
  ]);
  y = section(p2, bold, 'Turno', ny - 22);
  y = step(p2, font, bold, 1, 'Arriba toca En línea',
    'Si dice Conectarme, tócalo. Sin eso no te pueden asignar.', y);
  y = step(p2, font, bold, 2, 'Espera que tu jefe te asigne',
    'El pedido nuevo lo ve primero el jefe. Cuando te lo da, te suena. Ahí toca Aceptar.', y);
  y = step(p2, font, bold, 3, 'Ve a la sucursal',
    'Toca Navegar a sucursal. En el local toca Pedido recogido.', y);
  y = step(p2, font, bold, 4, 'Lleva a la casa y cierra el pedido',
    'Toca Navegar al cliente. Cobra el total. En la casa toca Entregado.', y);

  y = section(p2, bold, 'Quién te ve en el mapa', y - 2);
  const mapH = 86;
  const colW = (A4.w - M * 2 - 16) / 3;
  const mapY = y - mapH;
  p2.drawRectangle({ x: M, y: mapY, width: colW, height: mapH, color: CREAM, borderRadius: 8 });
  draw.text(p2, bold, 'Sucursal', M + 10, mapY + mapH - 16, 9, INK);
  draw.text(p2, bold, 'Casa', M + colW - 36, mapY + mapH - 16, 9, GREEN);
  p2.drawRectangle({ x: M + 16, y: mapY + 40, width: colW - 32, height: 4, color: RED, borderRadius: 2 });
  p2.drawCircle({ x: M + 16, y: mapY + 42, size: 6, color: BLACK });
  p2.drawCircle({ x: M + colW / 2, y: mapY + 42, size: 6, color: RED });
  p2.drawCircle({ x: M + colW - 16, y: mapY + 42, size: 6, color: GREEN });
  const tuW = bold.widthOfTextAtSize('tú', 9);
  draw.text(p2, bold, 'tú', M + colW / 2 - tuW / 2, mapY + 18, 9, RED);
  p2.drawRectangle({ x: M + colW + 8, y: mapY, width: colW, height: mapH, color: SOFT, borderRadius: 8 });
  draw.text(p2, bold, 'El local', M + colW + 18, mapY + mapH - 20, 11, INK);
  wrap(font, 'Te ve en En vivo desde que tocas Aceptar.', 10, colW - 20)
    .forEach((ln, i) => draw.text(p2, font, ln, M + colW + 18, mapY + mapH - 38 - i * 13, 10, INK));
  p2.drawRectangle({ x: M + colW * 2 + 16, y: mapY, width: colW, height: mapH, color: SOFT, borderRadius: 8 });
  draw.text(p2, bold, 'El cliente', M + colW * 2 + 26, mapY + mapH - 20, 11, INK);
  wrap(font, 'Te ve recién cuando tocas Pedido recogido.', 10, colW - 20)
    .forEach((ln, i) => draw.text(p2, font, ln, M + colW * 2 + 26, mapY + mapH - 38 - i * 13, 10, INK));

  y = mapY - 16;
  p2.drawRectangle({ x: M, y: y - 36, width: A4.w - M * 2, height: 42, color: WARN, borderColor: WARN_LINE, borderWidth: 1, borderRadius: 7 });
  draw.text(p2, font, 'No cierres El Pollón deslizándola en recientes. Puedes usar WhatsApp o apagar la pantalla.', M + 10, y - 10, 10, WARN_INK);
  draw.text(p2, font, 'Puedes llevar 2, 3 o 4 pedidos (el número que te puso tu jefe) antes de marcar recojo.', M + 10, y - 24, 10, WARN_INK);

  y = section(p2, bold, 'Si algo falla', y - 56);
  const fails = [
    ['No instala.', 'Permite apps desconocidas y baja de nuevo por Wi-Fi.'],
    ['No llegan pedidos.', 'En línea ON · pide a tu jefe que te asigne.'],
    ['El local no te ve.', 'GPS Siempre · no mates la app · toca Compartir ubicación ahora.'],
    ['Acepté en Chrome.', 'Abre la app El Pollón. El pollito solo avisa.'],
  ];
  fails.forEach(([t, d]) => {
    draw.text(p2, bold, t, M, y, 10.5, INK);
    draw.text(p2, font, d, M + 108, y, 10.5, rgb(0.2, 0.2, 0.2));
    y -= 15;
  });
  footer(p2, font, bold, 'Guía flota 1.6.0  ·  Pásala por WhatsApp', 'www.el-pollon.cl/guia-flota.pdf');

  const bytes = await pdf.save();
  saveCopies(bytes, {
    public: 'guia-flota.pdf',
    copies: [
      'public/guia-repartidor.pdf',
      'docs/Guia-repartidor-app-nativa-El-Pollon.pdf',
      'docs/Guia-flota-El-Pollon.pdf',
      'public/DESCARGAR-APK/Guia-repartidor-El-Pollon.pdf',
      'public/DESCARGAR-APK/Guia-flota-El-Pollon.pdf',
    ],
  });
}

await buildJefe();
await buildFlota();
