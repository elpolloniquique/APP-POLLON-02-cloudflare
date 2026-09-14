-- =============================================================================
-- FIX: ambigüedad PostgREST entre ep_driver_profiles ↔ profiles
-- Causa: hay 2 FK (profile_id y approved_by) → error
--   "Could not embed because more than one relationship was found"
-- Solución: quitar FK de approved_by (la columna se conserva).
-- Ejecutar UNA VEZ en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.ep_driver_profiles
  DROP CONSTRAINT IF EXISTS ep_driver_profiles_approved_by_fkey;

-- Recarga el schema cache de PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';

SELECT 'OK: relación profiles ya no es ambigua' AS resultado;
