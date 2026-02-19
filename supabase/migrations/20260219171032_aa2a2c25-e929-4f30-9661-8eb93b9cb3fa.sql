
ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS security_settings jsonb DEFAULT '{
  "force_2fa": false,
  "session_timeout_minutes": 480,
  "ip_whitelist": []
}'::jsonb;
