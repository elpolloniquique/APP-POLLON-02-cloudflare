/**
 * Puente local gratuito — impresión WiFi desde tablet/móvil
 *
 * Ejecutar en UN PC del local (puede ser el mismo de caja), conectado al mismo WiFi
 * que la impresora térmica. La impresión en PC por navegador NO se modifica.
 *
 * Uso:
 *   set PRINTER_IP=192.168.1.100
 *   node scripts/local-print-bridge.mjs
 *
 * En Admin → Configuración:
 *   - IP impresora: 192.168.1.100
 *   - URL puente: http://IP-DEL-PC:3009  (ej. http://192.168.1.50:3009)
 */

import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PRINT_BRIDGE_PORT) || 3009;
const DEFAULT_PRINTER_IP = process.env.PRINTER_IP || '';
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT) || 9100;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, body) {
  res.writeHead(status, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function tcpSend(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.write(buffer, () => {
        socket.end();
      });
    });
    socket.setTimeout(12000, () => {
      socket.destroy();
      reject(new Error('Timeout al enviar a la impresora'));
    });
    socket.on('error', reject);
    socket.on('close', () => {
      setTimeout(resolve, 400);
    });
  });
}

function tcpProbe(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(4000, () => {
      socket.destroy();
      reject(new Error(`No responde ${host}:${port}`));
    });
    socket.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, service: 'el-pollon-print-bridge', port: PORT });
    return;
  }

  if (req.url === '/test' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const ip = body.ip || DEFAULT_PRINTER_IP;
      const port = Number(body.port) || DEFAULT_PRINTER_PORT;
      if (!ip) return sendJson(res, 400, { error: 'Falta IP de impresora' });
      await tcpProbe(ip, port);
      sendJson(res, 200, { ok: true, message: `Impresora accesible en ${ip}:${port}` });
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Error de conexión' });
    }
    return;
  }

  if (req.url === '/print' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const ip = body.ip || DEFAULT_PRINTER_IP;
      const port = Number(body.port) || DEFAULT_PRINTER_PORT;
      const data = body.data ? Buffer.from(body.data, 'base64') : null;
      if (!ip || !data?.length) {
        return sendJson(res, 400, { error: 'Faltan ip o data' });
      }
      await tcpSend(ip, port, data);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Error al imprimir' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Ruta no encontrada' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[El Pollón] Puente de impresión en http://0.0.0.0:${PORT}`);
  console.log('Endpoints: GET /health  POST /test  POST /print');
  if (DEFAULT_PRINTER_IP) {
    console.log(`Impresora por defecto: ${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}`);
  }
});
