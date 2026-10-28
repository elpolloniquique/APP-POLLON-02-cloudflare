-- =============================================================================
-- El Pollón — Precios por categoría (ahora o programados)
-- Ejecutar en Supabase SQL Editor UNA vez.
-- No toca GPS, app nativa ni WhatsApp/Bot.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.auth_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ep_my_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
BEGIN
  SELECT role INTO r FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1;
  IF r IS NOT NULL AND r <> '' THEN
    RETURN r;
  END IF;
  BEGIN
    SELECT rol INTO r FROM administradores WHERE id = auth.uid() LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      r := NULL;
  END;
  RETURN COALESCE(r, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.ep_is_catalog_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ep_my_role() IN ('super_admin', 'admin_sucursal', 'administrador');
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_branch_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_my_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ep_is_catalog_admin() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.ep_menu_price_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',
  product_ids UUID[] NOT NULL DEFAULT '{}',
  mode TEXT NOT NULL DEFAULT 'add' CHECK (mode IN ('add', 'subtract', 'percent', 'set')),
  amount NUMERIC(12,0) NOT NULL DEFAULT 0,
  apply_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled', 'failed')),
  created_by UUID,
  created_by_email TEXT,
  applied_at TIMESTAMPTZ,
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ep_menu_price_jobs_due
  ON public.ep_menu_price_jobs (apply_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ep_menu_price_jobs_branch
  ON public.ep_menu_price_jobs (branch_id, created_at DESC);

ALTER TABLE public.ep_menu_price_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ep_menu_price_jobs_select ON public.ep_menu_price_jobs;
CREATE POLICY ep_menu_price_jobs_select ON public.ep_menu_price_jobs
  FOR SELECT TO authenticated
  USING (
    public.ep_is_catalog_admin()
    AND (
      public.ep_my_role() = 'super_admin'
      OR branch_id = public.auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS ep_menu_price_jobs_insert ON public.ep_menu_price_jobs;
CREATE POLICY ep_menu_price_jobs_insert ON public.ep_menu_price_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.ep_is_catalog_admin()
    AND (
      public.ep_my_role() = 'super_admin'
      OR branch_id = public.auth_user_branch_id()
    )
  );

DROP POLICY IF EXISTS ep_menu_price_jobs_update ON public.ep_menu_price_jobs;
CREATE POLICY ep_menu_price_jobs_update ON public.ep_menu_price_jobs
  FOR UPDATE TO authenticated
  USING (
    public.ep_is_catalog_admin()
    AND (
      public.ep_my_role() = 'super_admin'
      OR branch_id = public.auth_user_branch_id()
    )
  )
  WITH CHECK (
    public.ep_is_catalog_admin()
    AND (
      public.ep_my_role() = 'super_admin'
      OR branch_id = public.auth_user_branch_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.ep_menu_price_jobs TO authenticated;
GRANT ALL ON public.ep_menu_price_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.ep_apply_due_menu_price_jobs(p_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job RECORD;
  pid UUID;
  cur NUMERIC;
  nxt NUMERIC;
  applied_n INT := 0;
  items JSONB;
  max_n INT;
BEGIN
  max_n := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
  FOR job IN
    SELECT *
    FROM public.ep_menu_price_jobs
    WHERE status = 'pending'
      AND apply_at <= now()
    ORDER BY apply_at ASC
    LIMIT max_n
    FOR UPDATE SKIP LOCKED
  LOOP
    items := '[]'::jsonb;
    FOREACH pid IN ARRAY COALESCE(job.product_ids, '{}'::uuid[]) LOOP
      SELECT price INTO cur
      FROM public.products
      WHERE id = pid
        AND branch_id = job.branch_id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
      nxt := CASE job.mode
        WHEN 'add' THEN GREATEST(0, ROUND(cur + job.amount))
        WHEN 'subtract' THEN GREATEST(0, ROUND(cur - job.amount))
        WHEN 'percent' THEN GREATEST(0, ROUND(cur * (1 + (job.amount / 100.0))))
        WHEN 'set' THEN GREATEST(0, ROUND(job.amount))
        ELSE cur
      END;
      UPDATE public.products
         SET price = nxt,
             old_price = cur,
             updated_at = now()
       WHERE id = pid;
      items := items || jsonb_build_array(jsonb_build_object(
        'id', pid,
        'old', cur,
        'new', nxt
      ));
    END LOOP;
    UPDATE public.ep_menu_price_jobs
       SET status = 'applied',
           applied_at = now(),
           result = items,
           error = NULL
     WHERE id = job.id;
    applied_n := applied_n + 1;
  END LOOP;
  RETURN jsonb_build_object('applied', applied_n);
END;
$$;

REVOKE ALL ON FUNCTION public.ep_apply_due_menu_price_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ep_apply_due_menu_price_jobs(INT) TO anon, authenticated, service_role;
