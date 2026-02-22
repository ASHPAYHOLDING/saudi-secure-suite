
-- Platform updates table for managing changelog entries
CREATE TABLE public.platform_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Zap',
  tag TEXT NOT NULL DEFAULT 'نظام جديد' CHECK (tag IN ('نظام جديد', 'تحسين', 'إصلاح', 'أداء')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_updates ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can view published updates)
CREATE POLICY "Anyone can view published updates"
  ON public.platform_updates
  FOR SELECT
  USING (is_published = true);

-- Platform admins can do everything
CREATE POLICY "Platform admins can manage updates"
  ON public.platform_updates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- Index for ordering
CREATE INDEX idx_platform_updates_published_at ON public.platform_updates(published_at DESC);
CREATE INDEX idx_platform_updates_tag ON public.platform_updates(tag);

-- Trigger for updated_at
CREATE TRIGGER update_platform_updates_updated_at
  BEFORE UPDATE ON public.platform_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
