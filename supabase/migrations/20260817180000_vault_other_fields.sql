-- Extra fields for vault category "other": system type label + login URL

ALTER TABLE public.vault_entries
  ADD COLUMN IF NOT EXISTS system_type text,
  ADD COLUMN IF NOT EXISTS login_url text;

CREATE OR REPLACE FUNCTION public.vault_entries_set_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := lower(
    trim(
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.username, '') || ' ' ||
      coalesce(NEW.description, '') || ' ' ||
      coalesce(NEW.category, '') || ' ' ||
      coalesce(NEW.system_type, '') || ' ' ||
      coalesce(NEW.login_url, '')
    )
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vault_entries_search_text_trg ON public.vault_entries;

CREATE TRIGGER vault_entries_search_text_trg
  BEFORE INSERT OR UPDATE OF title, username, description, category, system_type, login_url
  ON public.vault_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.vault_entries_set_search_text();

COMMENT ON COLUMN public.vault_entries.system_type IS
  'Free-text system type when category = other';
COMMENT ON COLUMN public.vault_entries.login_url IS
  'Login URL for the system';
