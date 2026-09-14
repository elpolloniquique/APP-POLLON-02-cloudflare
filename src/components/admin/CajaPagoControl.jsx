import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, Check, ChevronDown } from 'lucide-react';
import {
  CAJA_PAGO,
  CAJA_PAGO_OPTIONS,
  cajaPagoLabel,
  resolveCajaPagoStatus,
} from '../../utils/cajaPago';

/**
 * Botón de cobro interno (caja/admin).
 * Menú en portal (fixed) para que no lo tape overflow de tablas/scroll.
 */
export function CajaPagoControl({
  order,
  onChange,
  disabled = false,
  menuHint = 'Control de caja',
  title = 'Marcar cobro (solo caja)',
}) {
  const status = resolveCajaPagoStatus(order);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const updateCoords = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuW = 168;
    const pad = 8;
    let left = r.left + r.width / 2 - menuW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 180 && r.top > spaceBelow;
    setCoords({
      left,
      top: openUp ? undefined : r.bottom + 6,
      bottom: openUp ? window.innerHeight - r.top + 6 : undefined,
      width: menuW,
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateCoords();
    const onScroll = () => updateCoords();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const tone =
    status === CAJA_PAGO.PAGADO
      ? 'caja-pago--pagado'
      : status === CAJA_PAGO.POR_PAGAR
        ? 'caja-pago--por-pagar'
        : 'caja-pago--na';

  const pick = async (next) => {
    setOpen(false);
    if (disabled || next === status) return;
    await onChange?.(next);
  };

  const menu = open && coords && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        className="caja-pago-menu"
        role="menu"
        style={{
          position: 'fixed',
          left: coords.left,
          top: coords.top,
          bottom: coords.bottom,
          width: coords.width,
          zIndex: 9999,
        }}
      >
        <p className="caja-pago-menu__hint">{menuHint}</p>
        {CAJA_PAGO_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            role="menuitem"
            className={`caja-pago-menu__item ${status === opt ? 'is-active' : ''}`}
            onClick={() => pick(opt)}
          >
            <span>{cajaPagoLabel(opt)}</span>
            {status === opt && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="caja-pago-wrap">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`caja-pago caja-pago--btn ${tone}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Banknote className="h-3.5 w-3.5 shrink-0" />
        <span>{cajaPagoLabel(status)}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}
