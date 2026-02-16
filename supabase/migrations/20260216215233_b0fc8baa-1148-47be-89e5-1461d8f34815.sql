
CREATE OR REPLACE FUNCTION public.create_default_chat_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (tenant_id, name, name_ar, description, is_default, created_by)
  VALUES
    (NEW.id, 'general', 'عام', 'General discussion', true, NEW.created_by),
    (NEW.id, 'finance', 'المالية', 'Finance discussions', false, NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
