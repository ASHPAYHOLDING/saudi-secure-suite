
-- User favorites / pinned pages
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'page',          -- page | report | customer | etc.
  ref_id TEXT,                                 -- optional entity id
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon_name TEXT,                              -- lucide icon name for display
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, path)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
  ON public.user_favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.user_favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_favorites_user_tenant ON public.user_favorites(user_id, tenant_id, sort_order);
