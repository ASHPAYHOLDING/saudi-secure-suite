-- 1️⃣ سحب التنفيذ من anon + PUBLIC
REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM anon, PUBLIC;

-- 2️⃣ تأكد أنها متاحة لـ service_role فقط
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;