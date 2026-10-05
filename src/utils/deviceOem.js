/** Detección de marca OEM para avisos PWA (Xiaomi mata Chrome en segundo plano). */

function uaHaystack() {
  if (typeof navigator === 'undefined') return '';
  const brands = (navigator.userAgentData?.brands || []).map((b) => b.brand).join(' ');
  const model = navigator.userAgentData?.mobile ? 'mobile' : '';
  return `${navigator.userAgent || ''} ${navigator.vendor || ''} ${brands} ${model}`;
}

export function getDeviceOem() {
  const ua = uaHaystack();
  if (/Xiaomi|Redmi|POCO|MIUI|HyperOS|MiuiBrowser/i.test(ua)) return 'xiaomi';
  if (/Huawei|Honor|HMSCore|Harmony/i.test(ua) && !/Google/i.test(ua)) return 'huawei';
  if (/OPPO|ColorOS|Realme/i.test(ua)) return 'oppo';
  if (/vivo|Funtouch|OriginOS/i.test(ua)) return 'vivo';
  if (/Samsung|SM-/i.test(ua)) return 'samsung';
  return 'other';
}

export function oemNeedsChromeLock() {
  const oem = getDeviceOem();
  return oem === 'xiaomi' || oem === 'huawei' || oem === 'oppo' || oem === 'vivo';
}

export function oemPushTips() {
  const oem = getDeviceOem();
  if (oem === 'xiaomi') {
    return {
      title: 'Xiaomi / Redmi / POCO',
      steps: [
        'Instala El Pollón (ícono pollito) en la pantalla de inicio. No lo dejes solo como pestaña de Chrome.',
        'Ajustes → Apps → Chrome → Autostart / Inicio automático: ON.',
        'Ajustes → Apps → Chrome → Ahorro de batería: Sin restricciones.',
        'En recientes, arrastra El Pollón hacia abajo y tócalo para “bloquear” / no limpiar.',
        'Ajustes → Apps → Chrome → Otras permisos → Mostrar ventanas emergentes en segundo plano: ON.',
      ],
    };
  }
  if (oem === 'huawei') {
    return {
      title: 'Huawei / Honor',
      steps: [
        'Instala El Pollón en la pantalla de inicio.',
        'Ajustes → Apps → Chrome (o el navegador) → Inicio de app: gestión manual, todo ON.',
        'Batería → Sin restricciones para Chrome y El Pollón.',
        'Si el celular no tiene Google Play, usa la app nativa de repartidor: el aviso web no llega.',
      ],
    };
  }
  if (oem === 'oppo') {
    return {
      title: 'OPPO / Realme',
      steps: [
        'Instala El Pollón en la pantalla de inicio.',
        'Ajustes → Batería → Chrome y El Pollón: sin ahorro.',
        'Inicio automático: ON para Chrome.',
      ],
    };
  }
  if (oem === 'vivo') {
    return {
      title: 'Vivo',
      steps: [
        'Instala El Pollón en la pantalla de inicio.',
        'iManager → Gestor de batería → sin alta restricción para Chrome.',
        'Permite inicio en segundo plano.',
      ],
    };
  }
  if (oem === 'samsung') {
    return {
      title: 'Samsung',
      steps: [
        'Instala El Pollón en la pantalla de inicio.',
        'Ajustes → Batería → Límites en segundo plano: no pongas Chrome en “Reposo”.',
      ],
    };
  }
  const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  if (android) {
    return {
      title: 'Xiaomi, Huawei, OPPO, Vivo y similares',
      steps: [
        'Instala El Pollón (ícono pollito) en la pantalla de inicio. No lo dejes solo como pestaña.',
        'Ajustes → Apps → Chrome → Autostart / Inicio automático: ON.',
        'Ajustes → Apps → Chrome → Ahorro de batería: Sin restricciones.',
        'En recientes, no deslices El Pollón para cerrarlo; bloquéalo si tu marca lo permite.',
        'Si aún no llega el aviso, usa la app nativa de repartidor: ahí sí llega en Xiaomi.',
      ],
    };
  }
  return {
    title: 'Tu celular',
    steps: [
      'Instala El Pollón (ícono pollito) y permite notificaciones una vez.',
      'No fuerces el cierre de Chrome ni de El Pollón desde recientes.',
    ],
  };
}
