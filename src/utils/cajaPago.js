/**
 * Control de cobro interno para cajeras (NO va al ticket ni al cliente).
 * Por defecto N/A hasta que la cajera marque Por pagar o Pagado.
 * Las 3 opciones son siempre editables.
 */
export const CAJA_PAGO = {
  NA: 'na',
  POR_PAGAR: 'por_pagar',
  PAGADO: 'pagado',
};

export const CAJA_PAGO_OPTIONS = [
  CAJA_PAGO.NA,
  CAJA_PAGO.POR_PAGAR,
  CAJA_PAGO.PAGADO,
];

/**
 * Estado efectivo que debe ver la cajera.
 * Default: N/A (sin marcar) hasta que elijan Por pagar / Pagado.
 */
export function resolveCajaPagoStatus(order) {
  if (order?.cajaPago === CAJA_PAGO.PAGADO) return CAJA_PAGO.PAGADO;
  if (order?.cajaPago === CAJA_PAGO.POR_PAGAR) return CAJA_PAGO.POR_PAGAR;
  return CAJA_PAGO.NA;
}

export function cajaPagoLabel(status) {
  if (status === CAJA_PAGO.PAGADO) return 'Pagado';
  if (status === CAJA_PAGO.POR_PAGAR) return 'Por pagar';
  return 'N/A';
}

export function canEditCajaPago() {
  return true;
}
