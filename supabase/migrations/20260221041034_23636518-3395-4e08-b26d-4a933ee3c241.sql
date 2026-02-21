
-- Audit Intelligence: compute risk scores from audit data
CREATE OR REPLACE FUNCTION public.get_audit_risk_scores(p_tenant_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(
  user_id uuid,
  policy_violations bigint,
  high_value_approvals bigint,
  after_hours_actions bigint,
  risk_score numeric,
  total_actions bigint,
  spike_detected boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      al.user_id AS uid,
      -- Policy violations
      COALESCE((
        SELECT COUNT(*) FROM policy_violations pv
        WHERE pv.user_id = al.user_id AND pv.tenant_id = p_tenant_id AND pv.created_at >= v_cutoff
      ), 0) AS violations,
      -- High value approvals (approval actions where document_amount > 50000)
      COALESCE((
        SELECT COUNT(*) FROM approval_actions aa
        JOIN approval_requests ar ON ar.id = aa.request_id
        WHERE aa.acted_by = al.user_id AND aa.tenant_id = p_tenant_id
          AND aa.action = 'approved' AND ar.document_amount > 50000
          AND aa.acted_at >= v_cutoff
      ), 0) AS hv_approvals,
      -- After hours actions (before 7am or after 10pm)
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM al.created_at) < 7 OR EXTRACT(HOUR FROM al.created_at) >= 22) AS after_hrs,
      -- Total actions
      COUNT(*) AS total_act
    FROM audit_logs al
    WHERE al.tenant_id = p_tenant_id AND al.created_at >= v_cutoff
    GROUP BY al.user_id
  ),
  -- Spike detection: user did >3x their daily average in any single day
  daily_counts AS (
    SELECT al.user_id AS uid, al.created_at::date AS d, COUNT(*) AS day_count
    FROM audit_logs al
    WHERE al.tenant_id = p_tenant_id AND al.created_at >= v_cutoff
    GROUP BY al.user_id, al.created_at::date
  ),
  user_avg AS (
    SELECT uid, AVG(day_count) AS avg_daily, MAX(day_count) AS max_daily
    FROM daily_counts GROUP BY uid
  )
  SELECT
    us.uid,
    us.violations,
    us.hv_approvals,
    us.after_hrs,
    (us.violations * 5 + us.hv_approvals * 2 + us.after_hrs * 1)::numeric AS risk,
    us.total_act,
    COALESCE(ua.max_daily > ua.avg_daily * 3 AND ua.avg_daily > 2, false) AS spike
  FROM user_stats us
  LEFT JOIN user_avg ua ON ua.uid = us.uid
  ORDER BY risk DESC;
END;
$$;

-- Revoke public access, only service_role
REVOKE ALL ON FUNCTION public.get_audit_risk_scores(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_risk_scores(uuid, int) TO service_role;

-- Heatmap: transactions grouped by user and hour-of-day
CREATE OR REPLACE FUNCTION public.get_audit_heatmap(p_tenant_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(
  user_id uuid,
  hour_of_day int,
  day_of_week int,
  action_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.user_id,
    EXTRACT(HOUR FROM al.created_at)::int,
    EXTRACT(ISODOW FROM al.created_at)::int,
    COUNT(*)
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id AND al.created_at >= now() - (p_days || ' days')::interval
  GROUP BY al.user_id, EXTRACT(HOUR FROM al.created_at)::int, EXTRACT(ISODOW FROM al.created_at)::int
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_heatmap(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_heatmap(uuid, int) TO service_role;

-- Timeline: daily action counts for chart
CREATE OR REPLACE FUNCTION public.get_audit_timeline(p_tenant_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(
  action_date date,
  total_actions bigint,
  unique_users bigint,
  high_risk_actions bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.created_at::date,
    COUNT(*),
    COUNT(DISTINCT al.user_id),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM al.created_at) < 7 OR EXTRACT(HOUR FROM al.created_at) >= 22)
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id AND al.created_at >= now() - (p_days || ' days')::interval
  GROUP BY al.created_at::date
  ORDER BY al.created_at::date;
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_timeline(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_timeline(uuid, int) TO service_role;

-- Rapid approval chains: approvals completed within 60 seconds
CREATE OR REPLACE FUNCTION public.get_rapid_approval_chains(p_tenant_id uuid, p_days int DEFAULT 30)
RETURNS TABLE(
  request_id uuid,
  document_type text,
  document_number text,
  document_amount numeric,
  approval_seconds numeric,
  acted_by uuid,
  acted_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.document_type,
    ar.document_number,
    ar.document_amount,
    EXTRACT(EPOCH FROM (aa.acted_at - ar.created_at))::numeric AS secs,
    aa.acted_by,
    aa.acted_at
  FROM approval_actions aa
  JOIN approval_requests ar ON ar.id = aa.request_id
  WHERE aa.tenant_id = p_tenant_id
    AND aa.action = 'approved'
    AND aa.acted_at IS NOT NULL
    AND aa.acted_at >= now() - (p_days || ' days')::interval
    AND EXTRACT(EPOCH FROM (aa.acted_at - ar.created_at)) < 60
  ORDER BY secs;
END;
$$;

REVOKE ALL ON FUNCTION public.get_rapid_approval_chains(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_rapid_approval_chains(uuid, int) TO service_role;
