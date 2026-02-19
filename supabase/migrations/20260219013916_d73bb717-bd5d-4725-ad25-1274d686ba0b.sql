
-- إصلاح: تحويل الـ View من SECURITY DEFINER إلى INVOKER (الافتراضي)
-- الـ View بالفعل INVOKER افتراضياً، لكن لنتأكد
ALTER VIEW zatca_certificates_safe SET (security_invoker = true);
