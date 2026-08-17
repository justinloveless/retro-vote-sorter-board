-- Trusted server helpers for Node API app_config reads/writes.
-- Local PostgREST RLS on app_config is admin-only; retroscope_app has no JWT
-- claims, so plain SELECT/INSERT hits RLS. These SECURITY DEFINER functions
-- run as the owner (postgres via db-init) and bypass RLS for the API only.
--
-- Coolify compose embeds this via configs.content — keep compose in sync.
-- SQL must stay free of dollar signs (Compose interpolates them).

CREATE OR REPLACE FUNCTION public.server_get_app_config(p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS '
  SELECT value FROM public.app_config WHERE key = p_key LIMIT 1;
';

CREATE OR REPLACE FUNCTION public.server_upsert_app_config(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS '
BEGIN
  INSERT INTO public.app_config (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
';

REVOKE ALL ON FUNCTION public.server_get_app_config(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.server_upsert_app_config(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_get_app_config(text) TO retroscope_app;
GRANT EXECUTE ON FUNCTION public.server_upsert_app_config(text, text) TO retroscope_app;
