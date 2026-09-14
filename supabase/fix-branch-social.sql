-- Redes sociales por sucursal (footer + admin)
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT DEFAULT '';
