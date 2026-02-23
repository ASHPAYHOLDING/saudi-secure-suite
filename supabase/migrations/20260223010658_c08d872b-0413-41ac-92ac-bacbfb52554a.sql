
-- Add archived_at column to tenant_notifications
ALTER TABLE public.tenant_notifications
ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Add archived_at column to user_notifications
ALTER TABLE public.user_notifications
ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Index for efficient archive filtering
CREATE INDEX IF NOT EXISTS idx_tenant_notifications_archived
ON public.tenant_notifications (tenant_id, archived_at)
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_archived
ON public.user_notifications (user_id, archived_at)
WHERE archived_at IS NULL;
