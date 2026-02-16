
-- =============================================
-- COLLABORATION SYSTEM: Comments, Chat, Mentions
-- =============================================

-- 1. Entity Comments (on invoices, contracts, expenses, etc.)
CREATE TABLE public.entity_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'invoice', 'contract', 'expense', 'quotation', 'sales_order', 'purchase_order'
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachment_url TEXT,
  attachment_name TEXT,
  parent_id UUID REFERENCES public.entity_comments(id) ON DELETE CASCADE, -- for threaded replies
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_comments_entity ON public.entity_comments(tenant_id, entity_type, entity_id);
CREATE INDEX idx_entity_comments_user ON public.entity_comments(user_id);

ALTER TABLE public.entity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view comments" ON public.entity_comments
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can create comments" ON public.entity_comments
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON public.entity_comments
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON public.entity_comments
  FOR DELETE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can delete any comment" ON public.entity_comments
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- 2. Chat Channels
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_chat_channels_tenant ON public.chat_channels(tenant_id);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view channels" ON public.chat_channels
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create channels" ON public.chat_channels
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update channels" ON public.chat_channels
  FOR UPDATE USING (is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete non-default channels" ON public.chat_channels
  FOR DELETE USING (is_tenant_admin(tenant_id) AND is_default = false);

-- 3. Chat Messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachment_url TEXT,
  attachment_name TEXT,
  parent_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL, -- replies
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_messages_tenant ON public.chat_messages(tenant_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view messages" ON public.chat_messages
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Users can update own messages" ON public.chat_messages
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Users can delete own messages" ON public.chat_messages
  FOR DELETE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can delete any message" ON public.chat_messages
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- 4. Collaboration Notifications (mentions, replies, etc.)
CREATE TABLE public.collaboration_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- recipient
  actor_id UUID NOT NULL, -- who triggered it
  type TEXT NOT NULL, -- 'mention_comment', 'mention_chat', 'reply_comment', 'reply_chat', 'new_message'
  entity_type TEXT, -- 'invoice', 'contract', 'expense', 'chat_channel'
  entity_id UUID,
  reference_id UUID, -- comment_id or message_id
  message TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collab_notif_user ON public.collaboration_notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_collab_notif_tenant ON public.collaboration_notifications(tenant_id);

ALTER TABLE public.collaboration_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.collaboration_notifications
  FOR SELECT USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "System can create notifications" ON public.collaboration_notifications
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update own notifications" ON public.collaboration_notifications
  FOR UPDATE USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

CREATE POLICY "Deny deletes on notifications" ON public.collaboration_notifications
  FOR DELETE USING (false);

-- 5. Storage bucket for collaboration attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('collaboration-attachments', 'collaboration-attachments', false);

CREATE POLICY "Tenant members can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'collaboration-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Tenant members can view attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collaboration-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'collaboration-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Enable realtime for chat messages and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_comments;

-- 7. Audit trigger for comments
CREATE OR REPLACE FUNCTION public.audit_comment_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, entity_label)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(auth.uid(), COALESCE(NEW.user_id, OLD.user_id)),
    TG_OP,
    'comment',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.entity_type || ':' || NEW.entity_id::text, OLD.entity_type || ':' || OLD.entity_id::text)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_entity_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.entity_comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_comment_action();

-- 8. Trigger to auto-create default channels for new tenants
CREATE OR REPLACE FUNCTION public.create_default_chat_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (tenant_id, name, name_ar, description, is_default, created_by)
  VALUES
    (NEW.id, 'general', 'عام', 'General discussion', true, NEW.owner_id),
    (NEW.id, 'finance', 'المالية', 'Finance discussions', false, NEW.owner_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_create_default_channels
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_chat_channels();

-- 9. Function to create notifications for mentions
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user UUID;
  notif_type TEXT;
  ent_type TEXT;
  ent_id UUID;
BEGIN
  -- Determine notification type based on table
  IF TG_TABLE_NAME = 'entity_comments' THEN
    notif_type := CASE WHEN NEW.parent_id IS NOT NULL THEN 'reply_comment' ELSE 'mention_comment' END;
    ent_type := NEW.entity_type;
    ent_id := NEW.entity_id;
  ELSIF TG_TABLE_NAME = 'chat_messages' THEN
    notif_type := CASE WHEN NEW.parent_id IS NOT NULL THEN 'reply_chat' ELSE 'mention_chat' END;
    ent_type := 'chat_channel';
    ent_id := NEW.channel_id;
  END IF;

  -- Create notification for each mentioned user
  IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
    FOREACH mentioned_user IN ARRAY NEW.mentions
    LOOP
      IF mentioned_user <> NEW.user_id THEN
        INSERT INTO public.collaboration_notifications (tenant_id, user_id, actor_id, type, entity_type, entity_id, reference_id, message)
        VALUES (NEW.tenant_id, mentioned_user, NEW.user_id, notif_type, ent_type, ent_id, NEW.id, LEFT(NEW.content, 200));
      END IF;
    END LOOP;
  END IF;

  -- Notify parent comment/message author on reply
  IF NEW.parent_id IS NOT NULL THEN
    DECLARE
      parent_user UUID;
    BEGIN
      IF TG_TABLE_NAME = 'entity_comments' THEN
        SELECT user_id INTO parent_user FROM public.entity_comments WHERE id = NEW.parent_id;
      ELSE
        SELECT user_id INTO parent_user FROM public.chat_messages WHERE id = NEW.parent_id;
      END IF;

      IF parent_user IS NOT NULL AND parent_user <> NEW.user_id THEN
        INSERT INTO public.collaboration_notifications (tenant_id, user_id, actor_id, type, entity_type, entity_id, reference_id, message)
        VALUES (NEW.tenant_id, parent_user, NEW.user_id, notif_type, ent_type, ent_id, NEW.id, LEFT(NEW.content, 200));
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_comment_mentions
  AFTER INSERT ON public.entity_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();

CREATE TRIGGER trg_notify_chat_mentions
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentions();
