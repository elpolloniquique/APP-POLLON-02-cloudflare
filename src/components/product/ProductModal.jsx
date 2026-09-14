import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Minus, Plus, Check, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { money, resolveMediaUrl } from '../../utils/format';
import {
  calcBagQty,
  calcLineTotal,
  formatBagRatioLabel,
  formatDrinksLabel,
  MODAL_DRINK_OPTIONS,
  resolveProductOptions,
} from '../../utils/productOptions';
import { fetchActiveDrinkFlavorNames } from '../../services/drinkFlavorsService';
import { useCart } from '../../context/CartContext';
import { useBranch } from '../../context/BranchContext';

function resizeDrinks(list, qty) {
  const next = [...(list || [])];
  while (next.length < qty) next.push('');
  return next.slice(0, qty);
}

function getMissingDrinkIndex(drinks) {
  return drinks.findIndex((d) => !String(d || '').trim());
}

function drinkValidationMessage(drinks) {
  const idx = getMissingDrinkIndex(drinks);
  if (idx < 0) return null;
  if (drinks.length <= 1) {
    return 'Primero elija el sabor de su bebida.';
  }
  return `Debe seleccionar el sabor de bebida de su plato ${idx + 1}.`;
}

function alertHeading(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('bebida') || m.includes('sabor')) return 'Bebida pendiente';
  if (m.includes('bolsa')) return 'Opción requerida';
  return 'Atención';
}

export function ProductModal({ product, category, categoryName = '', onClose, onAddOverride }) {
  const { addItem } = useCart();
  const { branch } = useBranch();
  const opts = useMemo(
    () => resolveProductOptions(product, categoryName),
    [product, categoryName],
  );

  const [qty, setQty] = useState(1);
  const [drinks, setDrinks] = useState(['']);
  const [bagSelected, setBagSelected] = useState(false);
  const [sideAlert, setSideAlert] = useState('');
  const [highlightDrinkIdx, setHighlightDrinkIdx] = useState(-1);
  const [drinkOptions, setDrinkOptions] = useState(MODAL_DRINK_OPTIONS);
  const drinkSectionRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchActiveDrinkFlavorNames(branch?.id)
      .then((names) => {
        if (!cancelled && names?.length) setDrinkOptions(names);
      })
      .catch(() => {
        if (!cancelled) setDrinkOptions(MODAL_DRINK_OPTIONS);
      });
    return () => { cancelled = true; };
  }, [branch?.id]);

  useEffect(() => {
    setQty(1);
    setDrinks(['']);
    setBagSelected(opts.bagRequired && opts.bagEnabled);
    setSideAlert('');
    setHighlightDrinkIdx(-1);
  }, [product?.id, opts.bagRequired, opts.bagEnabled]);

  useEffect(() => {
    setDrinks((prev) => resizeDrinks(prev, qty));
    if (opts.bagRequired && opts.bagEnabled) setBagSelected(true);
  }, [qty, opts.bagRequired, opts.bagEnabled]);

  useEffect(() => {
    if (!sideAlert) return undefined;
    const t = window.setTimeout(() => setSideAlert(''), 4500);
    return () => window.clearTimeout(t);
  }, [sideAlert]);

  if (!product) return null;

  const unitPrice = product.price;
  const bagQty = calcBagQty(qty, bagSelected, opts.bagUnitsPerBag);
  const lineTotal = calcLineTotal({
    unitPrice,
    qty,
    bagPrice: opts.bagPrice,
    includeBag: bagSelected,
    bagUnitsPerBag: opts.bagUnitsPerBag,
  });

  const hasCustomization = opts.drinkEnabled || opts.bagEnabled;

  const showSideAlert = (message) => {
    setSideAlert(message);
    if (opts.drinkEnabled) {
      const idx = getMissingDrinkIndex(drinks);
      setHighlightDrinkIdx(idx);
      if (idx >= 0) {
        drinkSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const setQtySafe = (next) => {
    setQty(Math.max(1, next));
    if (opts.bagRequired) setBagSelected(true);
    setSideAlert('');
    setHighlightDrinkIdx(-1);
  };

  const setDrinkAt = (index, value) => {
    setDrinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setSideAlert('');
    setHighlightDrinkIdx(-1);
  };

  const handleAdd = () => {
    if (opts.drinkEnabled) {
      const drinkMsg = drinkValidationMessage(drinks);
      if (drinkMsg) {
        showSideAlert(drinkMsg);
        return;
      }
    }
    if (opts.bagEnabled && opts.bagRequired && !bagSelected) {
      showSideAlert('Debe seleccionar la bolsa ecológica para continuar.');
      return;
    }

    setSideAlert('');
    setHighlightDrinkIdx(-1);
    const drinkLabel = formatDrinksLabel(drinks);
    const payload = {
      producto_id: product.id,
      name: product.name,
      qty,
      unitPrice,
      bagPrice: opts.bagPrice,
      bagUnitsPerBag: opts.bagUnitsPerBag,
      includeBag: bagSelected,
      total: lineTotal,
      drink: opts.drinkEnabled ? drinkLabel : null,
      drinks: opts.drinkEnabled ? drinks.filter(Boolean) : [],
      bagQty: opts.bagEnabled ? bagQty : 0,
      notes: '',
      category,
      available: product.available !== false,
    };
    if (onAddOverride) onAddOverride(payload);
    else {
      const r = addItem(payload);
      if (!r?.ok && r?.error) {
        showSideAlert(
          r.error === 'branch_mismatch'
            ? 'Vacíe el carrito para cambiar de sucursal'
            : 'No se pudo agregar al carrito',
        );
        return;
      }
    }
    onClose();
  };

  return (
    <>
      {sideAlert && (
        <div className="product-modal-alert" role="alert" aria-live="assertive">
          <div className="product-modal-alert__icon-wrap" aria-hidden>
            <AlertTriangle className="product-modal-alert__icon" strokeWidth={2.25} />
          </div>
          <div className="product-modal-alert__body">
            <p className="product-modal-alert__title">{alertHeading(sideAlert)}</p>
            <p className="product-modal-alert__text">{sideAlert}</p>
          </div>
        </div>
      )}

      <div
        className="product-modal-backdrop"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="product-modal product-modal--compact"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="product-modal-title"
        >
          <header className="product-modal__header">
            <div className="product-modal__banner">
              <UtensilsCrossed className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#c00000] shrink-0" strokeWidth={2.4} aria-hidden />
              <span>PERSONALIZA TU PEDIDO</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="product-modal__close"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5 sm:h-5.5 sm:w-5.5" strokeWidth={2.4} />
            </button>
          </header>

          <div className="product-modal__hero">
            <div className="product-modal__hero-media">
              <img
                src={resolveMediaUrl(product.image || product.imageUrl)}
                alt={product.name}
                className="product-modal__hero-img"
                loading="eager"
                onError={(e) => {
                  e.currentTarget.src = '/img/todo el menu.png';
                }}
              />
            </div>
            <div className="product-modal__hero-info">
              <h2 id="product-modal-title" className="product-modal__title">
                {product.name}
              </h2>
              {product.description && (
                <p className="product-modal__subtitle line-clamp-3">{product.description}</p>
              )}
            </div>
          </div>

          <div className="product-modal__body admin-scroll-panel">
            {opts.drinkEnabled && (
              <section ref={drinkSectionRef} className="product-modal__section product-modal__section--drinks">
                <div className="product-modal__section-head">
                  <h3 className="product-modal__section-title">ELIJA SU SABOR DE BEBIDA</h3>
                  <span className="product-modal__required">obligatorio</span>
                </div>
                {qty > 1 && (
                  <p className="product-modal__section-desc">
                    Elija un sabor para cada plato de su pedido
                  </p>
                )}

                {qty > 1 ? (
                  <div className="product-modal__units">
                    {drinks.map((d, i) => (
                      <div
                        key={i}
                        className={`product-modal__unit-block ${highlightDrinkIdx === i ? 'product-modal__unit-block--error' : ''}`}
                      >
                        <p className="product-modal__unit-label">Plato {i + 1}</p>
                        <div className="product-modal__option-grid">
                          {drinkOptions.map((option) => (
                            <DrinkOptionCard
                              key={`${i}-${option}`}
                              label={option}
                              selected={d === option}
                              onSelect={() => setDrinkAt(i, option)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="product-modal__option-grid">
                    {drinkOptions.map((option) => (
                      <DrinkOptionCard
                        key={option}
                        label={option}
                        selected={drinks[0] === option}
                        onSelect={() => setDrinkAt(0, option)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {opts.bagEnabled && (
              <section className="product-modal__section product-modal__section--bag">
                <button
                  type="button"
                  onClick={() => {
                    if (!opts.bagRequired) setBagSelected(!bagSelected);
                    setSideAlert('');
                  }}
                  aria-pressed={bagSelected}
                  className="product-modal-option--bag-clean"
                >
                  <span
                    className={`product-modal-checkbox ${bagSelected ? 'product-modal-checkbox--active-black' : ''}`}
                    aria-hidden
                  >
                    {bagSelected && <Check className="product-modal-checkbox__check" strokeWidth={3.2} />}
                  </span>
                  <span className="product-modal-option__copy">
                    <span className="product-modal-option__label--bag">
                      Bolsa ecológica <span className="product-modal-option__price">(+{money(opts.bagPrice)})</span>
                    </span>
                    <span className="product-modal-option__meta">
                      {formatBagRatioLabel(opts.bagUnitsPerBag)}
                      {bagSelected && bagQty > 0 && ` · ${bagQty} bolsa${bagQty !== 1 ? 's' : ''}`}
                    </span>
                  </span>
                </button>
              </section>
            )}

            {!hasCustomization && !product.description && (
              <p className="product-modal__empty-hint">Confirma cantidad y agrégalo a tu pedido</p>
            )}
          </div>

          <footer className="product-modal__footer product-modal__footer--compact">
            <div className="product-modal__checkout">
              <div className="product-modal__summary-row">
                <div className="product-modal__summary-qty">
                  <span className="product-modal__summary-label">CANTIDAD</span>
                  <div className="product-modal__qty product-modal__qty--compact">
                    <button
                      type="button"
                      onClick={() => setQtySafe(qty - 1)}
                      className="product-modal__qty-btn product-modal__qty-btn--minus"
                      aria-label="Menos"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={3.2} />
                    </button>
                    <span className="product-modal__qty-value">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQtySafe(qty + 1)}
                      className="product-modal__qty-btn product-modal__qty-btn--plus"
                      aria-label="Más"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={3.2} />
                    </button>
                  </div>
                </div>
                <div className="product-modal__summary-total">
                  <span className="product-modal__summary-total-label">TOTAL</span>
                  <span className="product-modal__summary-total-value">{money(lineTotal)}</span>
                </div>
              </div>

              <div className="product-modal__actions">
                <button type="button" onClick={onClose} className="product-modal__btn product-modal__btn--ghost">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="product-modal__btn product-modal__btn--primary"
                >
                  Agregar a carrito
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

function DrinkOptionCard({ label, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'product-modal-option',
        'product-modal-option--drink',
        selected ? 'product-modal-option--active' : '',
      ].filter(Boolean).join(' ')}
    >
      <span
        className={`product-modal-checkbox ${selected ? 'product-modal-checkbox--active-red' : ''}`}
        aria-hidden
      >
        {selected && <Check className="product-modal-checkbox__check" strokeWidth={3.2} />}
      </span>
      <span className="product-modal-option__label">{label}</span>
    </button>
  );
}
