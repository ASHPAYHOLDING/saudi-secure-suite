-- Drop paid integrations tables and related DB objects

-- Drop tenant activations first (foreign key dependency)
DROP TABLE IF EXISTS public.tenant_paid_integrations CASCADE;

-- Drop the main catalog table
DROP TABLE IF EXISTS public.paid_integrations CASCADE;

-- Drop related RPC functions
DROP FUNCTION IF EXISTS public.get_paid_integrations_state(uuid) CASCADE;