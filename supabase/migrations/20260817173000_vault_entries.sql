-- Shared org password vault (encrypted at app layer; ciphertext only in DB)

CREATE TABLE public.vault_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  username text,
  password_ciphertext text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  search_text text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_entries_category_check CHECK (
    category IN ('facebook', 'website', 'server', 'insurer', 'other')
  ),
  CONSTRAINT vault_entries_title_check CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX vault_entries_category_idx ON public.vault_entries (category);
CREATE INDEX vault_entries_search_text_idx ON public.vault_entries
  USING gin (to_tsvector('simple', search_text));
CREATE INDEX vault_entries_created_at_idx ON public.vault_entries (created_at DESC);

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
      coalesce(NEW.category, '')
    )
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vault_entries_search_text_trg
  BEFORE INSERT OR UPDATE OF title, username, description, category
  ON public.vault_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.vault_entries_set_search_text();

REVOKE ALL ON TABLE public.vault_entries FROM anon, authenticated;
GRANT SELECT ON TABLE public.vault_entries TO authenticated;
-- Writes go through server actions (service role) after requireAdmin

ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_entries_select_authenticated ON public.vault_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_active = true
    )
  );

COMMENT ON TABLE public.vault_entries IS
  'Org shared password vault; password stored as AES-GCM ciphertext only';
