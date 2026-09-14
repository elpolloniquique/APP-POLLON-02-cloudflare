import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'DESCARGAR-APK');
const target = join(outDir, 'El-Pollon-repartidor.apk');

const candidates = [
  join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  join(root, 'releases', 'El-Pollon-repartidor.apk'),
  join(root, 'releases', 'El-Pollon-repartidor-debug.apk'),
];

mkdirSync(outDir, { recursive: true });

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error('[apk:publish] No se encontró APK. Corre npm run build:apk:debug primero.');
  console.error('Buscado en:', candidates);
  process.exit(1);
}

copyFileSync(src, target);
const size = statSync(target).size;
console.log(`[apk:publish] OK → ${target}`);
console.log(`[apk:publish] Origen: ${src}`);
console.log(`[apk:publish] Tamaño: ${(size / 1024 / 1024).toFixed(1)} MB`);
console.log('[apk:publish] URL: /DESCARGAR-APK/El-Pollon-repartidor.apk');
