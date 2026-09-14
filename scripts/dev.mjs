/**
 * Arranque local: fuerza NODE_ENV=development.
 * Si Windows/Cursor deja NODE_ENV=production, Vite sirve como prod,
 * React no muestra errores y localhost queda en blanco.
 */
process.env.NODE_ENV = 'development';

const { spawn } = await import('node:child_process');
const child = spawn('vite', process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
