import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const media = join(root, 'public', 'guia-media');
const RED = rgb(0.753, 0, 0);
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.35, 0.35, 0.35);
const SOFT = rgb(0.965, 0.957, 0.945);
const LINE = rgb(0.9, 0.9, 0.9);
const GREEN = rgb(0.086, 0.396, 0.204);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.067, 0.067, 0.067);
const WARN = rgb(1, 0.969, 0.929);
const WARN_LINE = rgb(0.996, 0.843, 0.667);
const WARN_INK = rgb(0.486, 0.176, 0.071);
const A4 = { w: 595.28, h: 841.89 };
const M = 34;
const PHONE = 400 / 863;

function loadFontBytes(names) {
  for (const name of names) {
    try { return readFileSync(join('C:/Windows/Fonts', name)); } catch { /* next */ }
  }
  return null;
}

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

function txt(page, font, text, x, y, size, color = INK) {
  page.drawText(text, { x, y, size, font, color });
}

function header(page, font, bold, kicker, title, subtitle, chip) {
  txt(page, bold, kicker, M, A4.h - 40, 8.5, RED);
  txt(page, bold, title, M, A4.h - 64, 18, INK);
  txt(page, font, subtitle, M, A4.h - 80, 10, MUTED);
  page.drawRectangle({ x: M, y: A4.h - 90, width: A4.w - M * 2, height: 3, color: RED });
  const chipW = Math.min(bold.widthOfTextAtSize(chip, 8) + 16, 168);
  page.drawRectangle({
    x: A4.w - M - chipW, y: A4.h - 48, width: chipW, height: 18, color: BLACK, borderRadius: 9,
  });
  txt(page, bold, chip, A4.w - M - chipW + 8, A4.h - 43, 8, WHITE);
}

function footer(page, font, bold, left, right) {
  page.drawRectangle({ x: M, y: 26, width: A4.w - M * 2, height: 0.6, color: LINE });
  txt(page, font, left, M, 14, 8, MUTED);
  const rw = bold.widthOfTextAtSize(right, 8);
  txt(page, bold, right, A4.w - M - rw, 14, 8, INK);
}

function section(page, bold, title, y) {
  txt(page, bold, title.toUpperCase(), M, y, 10, RED);
  return y - 16;
}

function step(page, font, bold, num, title, body, y, maxW = A4.w - M * 2 - 34) {
  page.drawCircle({ x: M + 9, y: y + 4, size: 9, color: RED });
  const nw = bold.widthOfTextAtSize(String(num), 9);
  txt(page, bold, String(num), M + 9 - nw / 2, y, 9, WHITE);
  txt(page, bold, title, M + 28, y, 11.5, INK);
  let yy = y - 14;
  for (const line of wrap(font, body, 10, maxW)) {
    txt(page, font, line, M + 28, yy, 10, rgb(0.15, 0.15, 0.15));
    yy -= 12.5;
  }
  return yy - 6;
}

function noteBox(page, font, bold, y, lines) {
  const h = 16 + lines.length * 13;
  page.drawRectangle({
    x: M, y: y - h + 18, width: A4.w - M * 2, height: h,
    color: WARN, borderColor: WARN_LINE, borderWidth: 1, borderRadius: 7,
  });
  txt(page, bold, 'Importante', M + 10, y, 10, WARN_INK);
  lines.forEach((ln, i) => txt(page, font, ln, M + 10, y - 14 - i * 13, 10, WARN_INK));
  return y - h - 4;
}

function failList(page, font, bold, rows, y) {
  rows.forEach(([t, d]) => {
    txt(page, bold, t, M, y, 10, INK);
    wrap(font, d, 10, A4.w - M * 2 - 188).forEach((ln, i) => {
      txt(page, font, ln, M + 188, y - i * 12, 10, rgb(0.2, 0.2, 0.2));
    });
    y -= 16;
  });
  return y;
}

function phones(page, font, shots, items, y, h = 228) {
  const w = h * PHONE;
  const gap = 12;
  const total = items.length * w + (items.length - 1) * gap;
  let x = (A4.w - total) / 2;
  items.forEach(({ file, cap }) => {
    const img = shots[file];
    page.drawRectangle({
      x: x - 3, y: y - 3, width: w + 6, height: h + 6, color: BLACK, borderRadius: 14,
    });
    page.drawImage(img, { x, y, width: w, height: h });
    const capLines = wrap(font, cap, 8, w + 8);
    capLines.forEach((ln, i) => {
      const cw = font.widthOfTextAtSize(ln, 8);
      txt(page, font, ln, x + (w - cw) / 2, y - 14 - i * 10, 8, MUTED);
    });
    x += w + gap;
  });
  return y - 14 - 22;
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

async function embedShots(pdf, names) {
  const map = {};
  for (const name of names) {
    map[name] = await pdf.embedPng(readFileSync(join(media, name)));
  }
  return map;
}

function saveCopies(bytes, names) {
  mkdirSync(join(root, 'public', 'DESCARGAR-APK'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  const publicPath = join(root, 'public', names.public);
  writeFileSync(publicPath, bytes);
  for (const extra of names.copies) copyFileSync(publicPath, join(root, extra));
  console.log(`OK ${names.public} · ${bytes.length} bytes · ${names.pages} páginas`);
}

async function buildJefe() {
  const { pdf, font, bold } = await fonts();
  const shots = await embedShots(pdf, [
    'guia-login.png', 'guia-login-jefe.png',
    'guia-app-en-linea.png', 'guia-app-oferta.png', 'guia-app-recogido.png', 'guia-app-entregado.png',
    'guia-jefe-pedidos.png', 'guia-jefe-pedidos-cards.png', 'guia-jefe-menu.png',
    'guia-jefe-config.png', 'guia-jefe-nueva-moto.png', 'guia-jefe-editar-moto.png',
    'guia-jefe-asignar.png', 'guia-jefe-asignar-wa.png', 'guia-jefe-reportes.png',
  ]);

  const p1 = pdf.addPage([A4.w, A4.h]);
  header(p1, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Cómo instalar e iniciar sesión', 'Hoja 1 de 5  ·  App 1.6.0  ·  Un solo correo para todo', 'No uses la 1.5.0');
  let y = section(p1, bold, 'Instalar la app 1.6.0 en el celular', A4.h - 112);
  y = step(p1, font, bold, 1, 'Baja la app por Wi-Fi',
    'Abre en el celular: www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk', y);
  y = step(p1, font, bold, 2, 'Si dice “no se puede instalar”',
    'Toca Configuración y activa Permitir de esta fuente. Vuelve y toca Instalar.', y);
  y = step(p1, font, bold, 3, 'Abre el icono El Pollón',
    'Si ya tenías la 1.5.0, instala encima la 1.6.0. La vieja dice “solo para repartidores”.', y);
  y = section(p1, bold, 'Iniciar sesión (app o pollito)', y - 2);
  {
    const h = 228;
    y = phones(p1, font, shots, [
      { file: 'guia-login.png', cap: 'Correo arriba, clave abajo.' },
      { file: 'guia-login-jefe.png', cap: 'Tu correo de jefe + clave. Iniciar sesión.' },
    ], y - h, h);
  }
  noteBox(p1, font, bold, Math.max(y - 4, 92),
    ['El mismo correo sirve para las dos puertas: la app nativa (aceptar y entregar)', 'y el pollito www.el-pollon.cl (asignar motos). Ejemplo: antonyelpollon@gmail.com.']);
  footer(p1, font, bold, 'Mismo correo en la app y en el pollito.', 'Sigue en la hoja 2 →');

  const p2 = pdf.addPage([A4.w, A4.h]);
  header(p2, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Si el pedido lo llevas tú (app)', 'Hoja 2 de 5  ·  App nativa  ·  No esperes asignación', 'Tú ves todos los nuevos');
  y = section(p2, bold, 'Turno en la app', A4.h - 112);
  y = step(p2, font, bold, 1, 'Arriba deja En línea',
    'GPS Activo en línea. Los pedidos nuevos de tu sucursal te llegan solos.', y);
  y = step(p2, font, bold, 2, 'Toca Aceptar si lo llevas tú',
    'Así te lo quedas. La moto no lo ve. Si no puedes, Rechazar.', y);
  y = step(p2, font, bold, 3, 'Sucursal → casa',
    'Navegar a sucursal → Pedido recogido → Navegar al cliente → Entregado.', y);
  {
    const h = 188;
    y = phones(p2, font, shots, [
      { file: 'guia-app-en-linea.png', cap: 'En línea · GPS activo.' },
      { file: 'guia-app-oferta.png', cap: 'Pedido nuevo. Aceptar o Rechazar.' },
    ], y - h, h);
    y = phones(p2, font, shots, [
      { file: 'guia-app-recogido.png', cap: 'En el local: Pedido recogido.' },
      { file: 'guia-app-entregado.png', cap: 'En la casa cobra y Entregado.' },
    ], y - h, h);
  }
  footer(p2, font, bold, 'No uses Chrome para aceptar. Aceptar es en la app El Pollón.', 'Sigue en la hoja 3 →');

  const p3 = pdf.addPage([A4.w, A4.h]);
  header(p3, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Panel del jefe (pollito)', 'Hoja 3 de 5  ·  www.el-pollon.cl  ·  Pedidos nuevos', 'Menú ☰ Configuración');
  y = section(p3, bold, 'Entra al pollito', A4.h - 112);
  y = step(p3, font, bold, 1, 'Entra a www.el-pollon.cl con el mismo correo',
    'Vas a Repartidores. Aquí ves los pedidos nuevos y asignas a una moto. Hay botón Atrás en cada pantalla.', y);
  y = step(p3, font, bold, 2, 'Pedidos nuevos aparecen solos',
    'Urgente, Estándar o Nuevo. Toca Asignar Moto si lo lleva una moto de tu flota.', y);
  {
    const h = 248;
    y = phones(p3, font, shots, [
      { file: 'guia-jefe-pedidos.png', cap: 'Sin pedidos. Verde = disponibles.' },
      { file: 'guia-jefe-pedidos-cards.png', cap: 'Cuando llega uno: Asignar Moto.' },
      { file: 'guia-jefe-menu.png', cap: '☰ Repartidores, Configuración, Reportes.' },
    ], y - h, h);
  }
  noteBox(p3, font, bold, Math.max(y - 4, 78),
    ['Configuración (motos, + Moto, cupo) ya no está en Pedidos nuevos:', 'ábrela desde el menú ☰. Disponible (verde) / Ocupado (rojo) se actualiza solo.']);
  footer(p3, font, bold, 'Configuración de motos está en el menú hamburguesa.', 'Sigue en la hoja 4 →');

  const p4 = pdf.addPage([A4.w, A4.h]);
  header(p4, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Configuración de tu flota', 'Hoja 4 de 5  ·  Menú ☰ → Configuración', '+ Moto está aquí');
  y = section(p4, bold, 'Crear y editar motos', A4.h - 112);
  y = step(p4, font, bold, 1, 'Toca ☰ y luego Configuración',
    'Ahí está Tu flota, el botón rojo + Moto y Reportes.', y);
  y = step(p4, font, bold, 2, 'Crea una moto',
    'Nombre + correo + clave (mín. 6) + WhatsApp + patente. Cada moto entra con SU propio correo.', y);
  y = step(p4, font, bold, 3, 'Toca una moto para editarla',
    'Cupo (2, 3 o 4 pedidos), comisión %, Suspender o Guardar.', y);
  {
    const h = 268;
    phones(p4, font, shots, [
      { file: 'guia-jefe-config.png', cap: 'Tu flota. + Moto o toca una tarjeta.' },
      { file: 'guia-jefe-nueva-moto.png', cap: 'Nueva moto: correo y clave propios.' },
      { file: 'guia-jefe-editar-moto.png', cap: 'Editar: cupo máximo y comisión.' },
    ], y - h, h);
  }
  footer(p4, font, bold, 'Pásale a cada moto su correo, clave y la guía de flota.', 'Sigue en la hoja 5 →');

  const p5 = pdf.addPage([A4.w, A4.h]);
  header(p5, font, bold, 'EL POLLÓN  ·  JEFE DE REPARTIDORES', 'Asignar a una moto', 'Hoja 5 de 5  ·  Disponible en verde  ·  WhatsApp al asignar', 'La moto solo ve lo que le das');
  y = section(p5, bold, 'Asignar', A4.h - 112);
  y = step(p5, font, bold, 1, 'Toca Asignar Moto en el pedido',
    'Verde Disponible = puede llevarlo. Rojo No disponible = va hacia un cliente o tiene el cupo lleno.', y);
  y = step(p5, font, bold, 2, 'Después avisa por WhatsApp',
    'Aparece el botón verde. Ábrelo para que la moto acepte en su app. Tú no ves mapa En vivo.', y);
  {
    const h = 210;
    y = phones(p5, font, shots, [
      { file: 'guia-jefe-asignar.png', cap: 'Disponible (verde) / No disponible (rojo).' },
      { file: 'guia-jefe-asignar-wa.png', cap: 'Asignado. Toca el botón verde WhatsApp.' },
      { file: 'guia-jefe-reportes.png', cap: '☰ Reportes de tu flota.' },
    ], y - h, h);
  }
  y = section(p5, bold, 'Si algo falla', y - 4);
  failList(p5, font, bold, [
    ['Dice “solo para repartidores”.', 'Instala la APK 1.6.0. La 1.5.0 no sirve para el jefe.'],
    ['No me llegan pedidos.', 'App: En línea ON. GPS Siempre. Pollito: se actualiza solo.'],
    ['No veo + Moto.', 'Menú ☰ → Configuración.'],
    ['La moto no ve el pedido.', 'Asígnaselo aquí. Sin eso no le llega. Luego WhatsApp.'],
  ], y);
  footer(p5, font, bold, 'Guía jefe 1.6.0  ·  Pásala por WhatsApp', 'www.el-pollon.cl/guia-jefe-repartidores.pdf');

  const bytes = await pdf.save();
  saveCopies(bytes, {
    public: 'guia-jefe-repartidores.pdf',
    pages: 5,
    copies: [
      'docs/Guia-jefe-repartidores-El-Pollon.pdf',
      'public/DESCARGAR-APK/Guia-jefe-repartidores-El-Pollon.pdf',
    ],
  });
}

async function buildFlota() {
  const { pdf, font, bold } = await fonts();
  const shots = await embedShots(pdf, [
    'guia-login.png', 'guia-login-moto.png',
    'guia-app-en-linea.png', 'guia-app-oferta.png', 'guia-app-recogido.png', 'guia-app-entregado.png',
  ]);

  const p1 = pdf.addPage([A4.w, A4.h]);
  header(p1, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Cómo instalar e iniciar sesión', 'Hoja 1 de 4  ·  Se hace una sola vez  ·  Android', 'App El Pollón');
  let y = section(p1, bold, 'Instalar', A4.h - 112);
  y = step(p1, font, bold, 1, 'Baja la app en el celular',
    'Abre por Wi-Fi: www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk', y);
  y = step(p1, font, bold, 2, 'Si dice “no se puede instalar”',
    'Toca Configuración y activa Permitir de esta fuente. Vuelve y toca Instalar.', y);
  y = step(p1, font, bold, 3, 'Abre el icono El Pollón',
    'El pollito de Chrome solo avisa. Aceptar y entregar es en esta app.', y);
  y = section(p1, bold, 'Iniciar sesión con TU correo de moto', y - 2);
  {
    const h = 240;
    y = phones(p1, font, shots, [
      { file: 'guia-login.png', cap: 'Al abrir ves correo y contraseña.' },
      { file: 'guia-login-moto.png', cap: 'El correo que te dio tu jefe. No el del jefe.' },
    ], y - h, h);
  }
  noteBox(p1, font, bold, Math.max(y - 4, 88),
    ['Cada moto tiene su propio correo (ejemplo: joseelpollon@gmail.com).', 'Pídele a tu jefe: correo, clave y sucursal.']);
  footer(p1, font, bold, 'Pide a tu jefe: correo, contraseña y sucursal.', 'Sigue en la hoja 2 →');

  const p2 = pdf.addPage([A4.w, A4.h]);
  header(p2, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Permisos y En línea', 'Hoja 2 de 4  ·  Primera vez + todos los días', 'GPS Siempre');
  y = section(p2, bold, 'Primera vez', A4.h - 112);
  y = step(p2, font, bold, 1, 'Toca Permitir avisos, GPS y entrar',
    'Notificaciones: Permitir. Ubicación: Siempre / Permitir todo el tiempo. Ubicación precisa: Sí. Nunca “Solo esta vez”.', y);
  y = step(p2, font, bold, 2, 'Arriba toca En línea',
    'Si dice Conectarme, tócalo. Debe decir En línea y GPS Activo en línea. Sin eso tu jefe no te puede asignar.', y);
  {
    const h = 210;
    y = phones(p2, font, shots, [
      { file: 'guia-app-en-linea.png', cap: 'Así debes quedar: En línea y GPS Activo.' },
    ], y - h, h);
  }
  const boxH = 96;
  const boxW = (A4.w - M * 2 - 10) / 2;
  const boxY = Math.max(40, y - boxH - 8);
  p2.drawRectangle({ x: M, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  p2.drawRectangle({ x: M + boxW + 10, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  txt(p2, bold, 'Xiaomi / Redmi / POCO', M + 10, boxY + boxH - 16, 11, INK);
  txt(p2, font, '1. Autostart / Inicio automático: ON', M + 10, boxY + boxH - 34, 10, INK);
  txt(p2, font, '2. Batería: Sin restricciones', M + 10, boxY + boxH - 48, 10, INK);
  txt(p2, font, '3. En recientes, pon candado. No la deslices.', M + 10, boxY + boxH - 62, 10, INK);
  txt(p2, bold, 'Samsung / otras', M + boxW + 20, boxY + boxH - 16, 11, INK);
  txt(p2, font, '1. Batería de El Pollón: Sin restricciones', M + boxW + 20, boxY + boxH - 34, 10, INK);
  txt(p2, font, '2. No la pongas en Reposo', M + boxW + 20, boxY + boxH - 48, 10, INK);
  txt(p2, font, '3. Datos en segundo plano: ON', M + boxW + 20, boxY + boxH - 62, 10, INK);
  footer(p2, font, bold, 'No te llegan todos los pedidos: solo el que tu jefe te asigna.', 'Sigue en la hoja 3 →');

  const p3 = pdf.addPage([A4.w, A4.h]);
  header(p3, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Cómo trabajar un pedido', 'Hoja 3 de 4  ·  Primero te lo asigna el jefe', 'Haz esto, luego esto');
  y = section(p3, bold, 'Turno', A4.h - 112);
  y = step(p3, font, bold, 1, 'Cuando te asignan, te suena. Toca Aceptar',
    'Ves el cliente, la dirección y el total a cobrar. Si no puedes, Rechazar.', y);
  y = step(p3, font, bold, 2, 'Ve a la sucursal',
    'Toca Navegar a sucursal. En el local toca Pedido recogido.', y);
  y = step(p3, font, bold, 3, 'Lleva a la casa y cierra',
    'Toca Navegar al cliente. Cobra el total. En la casa toca Entregado.', y);
  {
    const h = 248;
    y = phones(p3, font, shots, [
      { file: 'guia-app-oferta.png', cap: '1. Te asignan → Aceptar (azul).' },
      { file: 'guia-app-recogido.png', cap: '2. En el local → Pedido recogido.' },
      { file: 'guia-app-entregado.png', cap: '3. En la casa cobra y Entregado.' },
    ], y - h, h);
  }
  noteBox(p3, font, bold, Math.max(y - 4, 78),
    ['El local te ve en En vivo desde que tocas Aceptar. El cliente te ve', 'recién cuando tocas Pedido recogido. Puedes llevar 2, 3 o 4 antes del recojo.']);
  footer(p3, font, bold, 'Aceptar siempre en la app El Pollón, no en Chrome.', 'Sigue en la hoja 4 →');

  const p4 = pdf.addPage([A4.w, A4.h]);
  header(p4, font, bold, 'EL POLLÓN  ·  FLOTA / MOTO', 'Antes de salir y si algo falla', 'Hoja 4 de 4  ·  Checklist', 'Léelo una vez');
  y = section(p4, bold, 'Antes de salir', A4.h - 112);
  const checks = [
    '☐  Instalé El Pollón (no el pollito)',
    '☐  Entré con MI correo de moto',
    '☐  Avisos: Permitir',
    '☐  GPS: Siempre',
    '☐  Arriba: En línea',
    '☐  Mi jefe ya me asignó uno de prueba',
  ];
  checks.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    txt(p4, font, c, M + col * 250, y - row * 16, 12, INK);
  });
  y -= 64;
  y = section(p4, bold, 'Si algo falla', y);
  y = failList(p4, font, bold, [
    ['No instala.', 'Permite apps desconocidas y baja de nuevo por Wi-Fi.'],
    ['No llegan pedidos.', 'En línea ON · pide a tu jefe que te asigne.'],
    ['El local no te ve.', 'GPS Siempre · no mates la app · Compartir ubicación ahora.'],
    ['Acepté en Chrome.', 'Abre la app El Pollón. El pollito solo avisa.'],
    ['Dice “solo para repartidores”.', 'Pide a tu jefe que te cree con tu propio correo.'],
  ], y);
  noteBox(p4, font, bold, y - 10,
    ['No cierres El Pollón deslizándola en recientes. Puedes usar WhatsApp', 'o apagar la pantalla. El GPS debe seguir activo.']);
  footer(p4, font, bold, 'Guía flota 1.6.0  ·  Pásala por WhatsApp', 'www.el-pollon.cl/guia-flota.pdf');

  const bytes = await pdf.save();
  saveCopies(bytes, {
    public: 'guia-flota.pdf',
    pages: 4,
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
