-- =============================================================================
-- EL POLLÓN — Métodos de pago por sucursal (efectivo / transferencia / tarjeta)
-- Ejecutar en Supabase SQL Editor UNA sola vez.
-- =============================================================================

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[]
  DEFAULT ARRAY['efectivo', 'transferencia']::text[];

UPDATE public.branches
SET payment_methods = ARRAY['efectivo', 'transferencia']::text[]
WHERE payment_methods IS NULL
   OR cardinality(payment_methods) = 0;

ALTER TABLE public.branches
  ALTER COLUMN payment_methods SET DEFAULT ARRAY['efectivo', 'transferencia']::text[];

ALTER TABLE public.branches
  ALTER COLUMN payment_methods SET NOT NULL;

ALTER TABLE public.branches
  DROP CONSTRAINT IF EXISTS branches_payment_methods_valid;

ALTER TABLE public.branches
  ADD CONSTRAINT branches_payment_methods_valid CHECK (
    cardinality(payment_methods) >= 1
    AND payment_methods <@ ARRAY['efectivo', 'transferencia', 'tarjeta']::text[]
  );

COMMENT ON COLUMN public.branches.payment_methods IS
  'Métodos de pago visibles en el checkout de esta sucursal. El cobro es siempre al recibir el pedido.';

NOTIFY pgrst, 'reload schema';
