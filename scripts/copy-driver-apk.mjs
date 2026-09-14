import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(root, '..');
const outDirs = [
  join(root, 'public', 'DESCARGAR-APK'),
  join(workspaceRoot, 'DESCARGAR-APK'),
];
const fileName = 'El-Pollon-repartidor.apk';

const candidates = [
  join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  join(root, 'releases', 'El-Pollon-repartidor.apk'),
];

function findApk() {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const debugDir = join(root, 'android', 'app', 'build', 'outputs', 'apk');
  if (!existsSync(debugDir)) return null;
  const stack = [debugDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (name.endsWith('.apk')) return full;
    }
  }
  return null;
}

const src = findApk();
if (!src) {
  console.error('[copy-driver-apk] No se encontró ningún APK. Corre: npm run build:apk:debug');
  process.exit(1);
}

console.log('[copy-driver-apk] OK');
console.log('  from:', src);
for (const outDir of outDirs) {
  mkdirSync(outDir, { recursive: true });
  const dest = join(outDir, fileName);
  copyFileSync(src, dest);
  console.log('  to:  ', dest);
}
