-- No-op fix: the previous migration already applied the function and trigger successfully.
-- The only failure was the realtime publication which was already configured.
-- This migration is a no-op confirmation.
SELECT 1;
