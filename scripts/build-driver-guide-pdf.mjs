import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
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
    try {
      return readFileSync(join('C:/Windows/Fonts', name));
    } catch {
      /* next */
    }
  }
  return null;
}

const draw = {
  text(page, font, text, x, y, size, color = INK) {
    page.drawText(text, { x, y, size, font, color });
  },
  rect(page, x, y, w, h, color, r = 0) {
    page.drawRectangle({ x, y, width: w, height: h, color, borderRadius: r });
  },
  round(page, x, y, w, h, color) {
    page.drawRectangle({ x, y, width: w, height: h, color, borderRadius: 8 });
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

async function main() {
  const regularBytes = loadFontBytes(['arial.ttf', 'ARIAL.TTF', 'calibri.ttf', 'Calibri.ttf']);
  const boldBytes = loadFontBytes(['arialbd.ttf', 'ARIALBD.TTF', 'calibrib.ttf', 'Calibri-Bold.ttf']);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = regularBytes ? await pdf.embedFont(regularBytes, { subset: true }) : await pdf.embedFont(StandardFonts.Helvetica);
  const bold = boldBytes ? await pdf.embedFont(boldBytes, { subset: true }) : await pdf.embedFont(StandardFonts.HelveticaBold);

  page1(pdf.addPage([A4.w, A4.h]), font, bold);
  page2(pdf.addPage([A4.w, A4.h]), font, bold);

  const bytes = await pdf.save();
  const outPublic = join(root, 'public', 'guia-repartidor.pdf');
  const outDocs = join(root, 'docs', 'Guia-repartidor-app-nativa-El-Pollon.pdf');
  const outApk = join(root, 'public', 'DESCARGAR-APK', 'Guia-repartidor-El-Pollon.pdf');
  const outRoot = join(root, 'Guia-repartidor-El-Pollon.pdf');
  writeFileSync(outPublic, bytes);
  copyFileSync(outPublic, outDocs);
  copyFileSync(outPublic, outApk);
  copyFileSync(outPublic, outRoot);
  console.log(`OK ${bytes.length} bytes · 2 páginas`);
}

function header(page, font, bold, title, subtitle, chip) {
  draw.text(page, bold, 'EL POLLÓN  ·  REPARTIDOR', M, A4.h - 42, 9, RED);
  draw.text(page, bold, title, M, A4.h - 68, 22, INK);
  draw.text(page, font, subtitle, M, A4.h - 86, 10, MUTED);
  page.drawRectangle({ x: M, y: A4.h - 98, width: A4.w - M * 2, height: 3, color: RED });

  const chipW = bold.widthOfTextAtSize(chip, 8) + 16;
  page.drawRectangle({
    x: A4.w - M - chipW,
    y: A4.h - 50,
    width: chipW,
    height: 18,
    color: BLACK,
    borderRadius: 9,
  });
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

function pill(page, bold, text, x, y, bg = BLACK) {
  const w = bold.widthOfTextAtSize(text, 8) + 10;
  page.drawRectangle({ x, y: y - 3, width: w, height: 13, color: bg, borderRadius: 4 });
  draw.text(page, bold, text, x + 5, y, 8, WHITE);
  return w;
}

function page1(page, font, bold) {
  header(page, font, bold, 'Cómo instalar y usar la app', 'Hoja 1 de 2  ·  Se hace una sola vez  ·  Android', 'App El Pollón');

  let y = section(page, bold, 'Instalar', A4.h - 122);
  y = step(page, font, bold, 1, 'Baja la app en el celular',
    'Abre este enlace por Wi-Fi: www.el-pollon.cl/DESCARGAR-APK/El-Pollon-repartidor.apk', y);
  y = step(page, font, bold, 2, 'Si dice “no se puede instalar”',
    'Toca Configuración y activa Permitir de esta fuente. Vuelve y toca Instalar. Si pregunta, elige No enviar / Instalar de todos modos.', y);
  y = step(page, font, bold, 3, 'Abre El Pollón',
    'Usa el icono El Pollón. El pollito de Chrome solo avisa. Aceptar, GPS y entrega es en esta app.', y);

  y = section(page, bold, 'Entrar y configurar', y - 4);
  y = step(page, font, bold, 4, 'Entra con tu correo de repartidor',
    'Correo y contraseña que te dio el local. Si no entra, te tienen que crear como repartidor y asignarte sucursal.', y);
  y = step(page, font, bold, 5, 'Toca Permitir avisos, GPS y entrar',
    'Notificaciones: Permitir. Ubicación: Siempre / Permitir todo el tiempo. Ubicación precisa: Sí. Nunca elijas Solo esta vez ni Mientras usas la app.', y);
  y = step(page, font, bold, 6, 'Deja la app así en Ajustes del celular',
    'Ajustes → Apps → El Pollón. Notificaciones ON. Ubicación Siempre. Batería Sin restricciones. Autostart ON (Xiaomi, Redmi, POCO, Huawei, OPPO).', y);

  const boxH = 118;
  const boxW = (A4.w - M * 2 - 10) / 2;
  const boxY = y - boxH - 4;
  page.drawRectangle({ x: M, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  page.drawRectangle({ x: M + boxW + 10, y: boxY, width: boxW, height: boxH, color: SOFT, borderRadius: 8 });
  draw.text(page, bold, 'Xiaomi / Redmi / POCO', M + 10, boxY + boxH - 18, 11, INK);
  draw.text(page, font, '1. Autostart / Inicio automático: ON', M + 10, boxY + boxH - 36, 10, INK);
  draw.text(page, font, '2. Batería: Sin restricciones', M + 10, boxY + boxH - 50, 10, INK);
  draw.text(page, font, '3. En recientes, pon candado.', M + 10, boxY + boxH - 64, 10, INK);
  draw.text(page, font, '   No la deslices para cerrar.', M + 10, boxY + boxH - 78, 10, INK);

  draw.text(page, bold, 'Samsung / otras', M + boxW + 20, boxY + boxH - 18, 11, INK);
  draw.text(page, font, '1. Batería de El Pollón: Sin restricciones', M + boxW + 20, boxY + boxH - 36, 10, INK);
  draw.text(page, font, '2. No la pongas en Reposo', M + boxW + 20, boxY + boxH - 50, 10, INK);
  draw.text(page, font, '3. Datos en segundo plano: ON', M + boxW + 20, boxY + boxH - 64, 10, INK);

  const noteY = boxY - 52;
  page.drawRectangle({ x: M, y: noteY, width: A4.w - M * 2, height: 42, color: WARN, borderColor: WARN_LINE, borderWidth: 1, borderRadius: 7 });
  draw.text(page, bold, 'Importante', M + 10, noteY + 26, 10, WARN_INK);
  draw.text(page, font, 'No elijas “Solo esta vez” ni “Mientras usas la app”. Si lo haces, al apagar', M + 10, noteY + 12, 10, WARN_INK);
  draw.text(page, font, 'la pantalla el local deja de verte. Pide al local: correo, contraseña y sucursal.', M + 10, noteY - 1, 10, WARN_INK);

  footer(page, font, bold, 'Pide al local: correo, contraseña y tu sucursal (Iquique o Alto Hospicio).', 'Sigue en la hoja 2 →');
}

function node(page, bold, font, x, y, w, h, bg, title, sub, ink = WHITE) {
  page.drawRectangle({ x, y, width: w, height: h, color: bg, borderRadius: 8 });
  const tw = bold.widthOfTextAtSize(title, 10);
  draw.text(page, bold, title, x + (w - tw) / 2, y + 28, 10, ink);
  const sw = font.widthOfTextAtSize(sub, 8);
  draw.text(page, font, sub, x + (w - sw) / 2, y + 14, 8, ink);
}

function page2(page, font, bold) {
  header(page, font, bold, 'Cómo trabajar un pedido', 'Hoja 2 de 2  ·  Todos los días  ·  Toca el botón que está en negrita', 'Haz esto, luego esto');

  const nw = 108;
  const nh = 50;
  const gap = 18;
  const total = nw * 4 + gap * 3;
  let x = (A4.w - total) / 2;
  const ny = A4.h - 168;
  node(page, bold, font, x, ny, nw, nh, BLACK, 'En línea', 'esperando');
  draw.text(page, bold, '→', x + nw + 3, ny + 18, 14, RED);
  x += nw + gap;
  node(page, bold, font, x, ny, nw, nh, RED, 'Aceptar', 'pedido nuevo');
  draw.text(page, bold, '→', x + nw + 3, ny + 18, 14, RED);
  x += nw + gap;
  page.drawRectangle({ x, y: ny, width: nw, height: nh, color: WHITE, borderColor: RED, borderWidth: 2, borderRadius: 8 });
  let tw = bold.widthOfTextAtSize('Pedido recogido', 9);
  draw.text(page, bold, 'Pedido recogido', x + (nw - tw) / 2, ny + 28, 9, INK);
  tw = font.widthOfTextAtSize('en el local', 8);
  draw.text(page, font, 'en el local', x + (nw - tw) / 2, ny + 14, 8, MUTED);
  draw.text(page, bold, '→', x + nw + 3, ny + 18, 14, RED);
  x += nw + gap;
  node(page, bold, font, x, ny, nw, nh, GREEN, 'Entregado', 'en la casa');

  let y = section(page, bold, 'Turno', ny - 22);
  y = step(page, font, bold, 1, 'Arriba toca En línea',
    'Si dice Conectarme, tócalo. Sin eso no te ofrecen pedidos.', y);
  y = step(page, font, bold, 2, 'Cuando suene, toca Aceptar',
    'Mira dirección, delivery y total a cobrar. Si no puedes, toca Rechazar.', y);
  y = step(page, font, bold, 3, 'Ve a la sucursal',
    'Toca Navegar a sucursal. En el local toca Pedido recogido.', y);
  y = step(page, font, bold, 4, 'Lleva a la casa y cierra el pedido',
    'Toca Navegar al cliente. Cobra el total. En la casa toca Entregado.', y);

  y = section(page, bold, 'Quién te ve en el mapa', y - 2);
  const mapH = 86;
  const colW = (A4.w - M * 2 - 16) / 3;
  const mapY = y - mapH;
  page.drawRectangle({ x: M, y: mapY, width: colW, height: mapH, color: CREAM, borderRadius: 8 });
  draw.text(page, bold, 'Sucursal', M + 10, mapY + mapH - 16, 9, INK);
  draw.text(page, bold, 'Casa', M + colW - 36, mapY + mapH - 16, 9, GREEN);
  page.drawRectangle({ x: M + 16, y: mapY + 40, width: colW - 32, height: 4, color: RED, borderRadius: 2 });
  page.drawCircle({ x: M + 16, y: mapY + 42, size: 6, color: BLACK });
  page.drawCircle({ x: M + colW / 2, y: mapY + 42, size: 6, color: RED });
  page.drawCircle({ x: M + colW - 16, y: mapY + 42, size: 6, color: GREEN });
  const tuW = bold.widthOfTextAtSize('tú', 9);
  draw.text(page, bold, 'tú', M + colW / 2 - tuW / 2, mapY + 18, 9, RED);

  page.drawRectangle({ x: M + colW + 8, y: mapY, width: colW, height: mapH, color: SOFT, borderRadius: 8 });
  draw.text(page, bold, 'El local', M + colW + 18, mapY + mapH - 20, 11, INK);
  const localLines = wrap(font, 'Te ve en En vivo desde que tocas Aceptar.', 10, colW - 20);
  localLines.forEach((ln, i) => draw.text(page, font, ln, M + colW + 18, mapY + mapH - 38 - i * 13, 10, INK));

  page.drawRectangle({ x: M + colW * 2 + 16, y: mapY, width: colW, height: mapH, color: SOFT, borderRadius: 8 });
  draw.text(page, bold, 'El cliente', M + colW * 2 + 26, mapY + mapH - 20, 11, INK);
  const cliLines = wrap(font, 'Te ve recién cuando tocas Pedido recogido.', 10, colW - 20);
  cliLines.forEach((ln, i) => draw.text(page, font, ln, M + colW * 2 + 26, mapY + mapH - 38 - i * 13, 10, INK));

  y = mapY - 16;
  page.drawRectangle({ x: M, y: y - 36, width: A4.w - M * 2, height: 42, color: WARN, borderColor: WARN_LINE, borderWidth: 1, borderRadius: 7 });
  draw.text(page, font, 'No cierres El Pollón deslizándola en recientes. Puedes usar WhatsApp o apagar la pantalla.', M + 10, y - 10, 10, WARN_INK);
  draw.text(page, font, 'Puedes llevar 2, 3 o 4 pedidos (el número que te puso el admin) antes de marcar recojo.', M + 10, y - 24, 10, WARN_INK);

  y = section(page, bold, 'Antes de salir', y - 56);
  const checks = [
    'Instalé El Pollón (no el pollito)',
    'Entré con mi correo',
    'Avisos: Permitir',
    'GPS: Siempre',
    'Arriba: En línea',
    'Ya acepté un pedido de prueba',
  ];
  checks.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = M + col * 255;
    const cy = y - row * 16;
    page.drawRectangle({ x: cx, y: cy - 1, width: 9, height: 9, borderColor: INK, borderWidth: 1, color: WHITE });
    draw.text(page, font, c, cx + 14, cy, 10.5, INK);
  });

  y = section(page, bold, 'Si algo falla', y - 58);
  const fails = [
    ['No instala.', 'Permite apps desconocidas y baja de nuevo por Wi-Fi.'],
    ['No llegan pedidos.', 'En línea ON · avisos Permitir · tu sucursal correcta.'],
    ['El local no te ve.', 'GPS Siempre · no mates la app · toca Compartir ubicación ahora.'],
    ['Acepté en Chrome.', 'Abre la app El Pollón. El pollito solo avisa.'],
  ];
  fails.forEach(([t, d]) => {
    draw.text(page, bold, t, M, y, 10.5, INK);
    draw.text(page, font, d, M + 108, y, 10.5, rgb(0.2, 0.2, 0.2));
    y -= 15;
  });

  footer(page, font, bold, 'Guía 1.5.0  ·  Pásala por WhatsApp', 'www.el-pollon.cl/guia-repartidor.pdf');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
