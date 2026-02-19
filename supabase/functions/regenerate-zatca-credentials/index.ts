import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = userData.user.id;
    const { tenantId, vatNumber } = await req.json();

    if (!tenantId || !vatNumber) {
      return new Response(JSON.stringify({ error: 'Missing tenantId or vatNumber' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify user is admin of this tenant
    const { data: membership } = await supabaseUser
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Update zatca_settings status to pending
    await supabaseAdmin.from('zatca_settings').upsert({
      tenant_id: tenantId,
      zatca_status: 'pending',
      last_error: null,
      credential_metadata: { vat_number: vatNumber, refresh_triggered_at: new Date().toISOString(), triggered_by: userId },
    }, { onConflict: 'tenant_id' });

    // Check if tenant has active ZATCA certificates
    const { data: certs } = await supabaseAdmin
      .from('zatca_certificates' as any)
      .select('id, certificate_type, environment, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    let newStatus = 'disconnected';
    let lastError: string | null = null;

    if (certs && certs.length > 0) {
      const hasProduction = certs.some((c: any) => c.certificate_type === 'production');
      const hasCompliance = certs.some((c: any) => c.certificate_type === 'compliance');

      // Validate VAT number format (Saudi VAT: 15 digits starting with 3)
      const vatRegex = /^3\d{14}$/;
      if (!vatRegex.test(vatNumber.replace(/\s/g, ''))) {
        newStatus = 'error';
        lastError = 'رقم ضريبي غير صالح — يجب أن يبدأ بـ 3 ويتكون من 15 رقماً';
      } else if (hasProduction) {
        newStatus = 'connected';
      } else if (hasCompliance) {
        newStatus = 'pending';
      }
    } else {
      // No certificates, check if VAT number is valid
      const vatRegex = /^3\d{14}$/;
      if (vatRegex.test(vatNumber.replace(/\s/g, ''))) {
        newStatus = 'pending';
      } else {
        newStatus = 'error';
        lastError = 'رقم ضريبي غير صالح';
      }
    }

    // Update tenant's vat_number
    await supabaseAdmin.from('tenants').update({ vat_number: vatNumber }).eq('id', tenantId);

    // Update zatca_settings with final status
    await supabaseAdmin.from('zatca_settings').upsert({
      tenant_id: tenantId,
      zatca_status: newStatus,
      last_credential_refresh: new Date().toISOString(),
      last_error: lastError,
      credential_metadata: {
        vat_number: vatNumber,
        certificates_count: certs?.length || 0,
        last_refresh: new Date().toISOString(),
        triggered_by: userId,
      },
    }, { onConflict: 'tenant_id' });

    // Log audit
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'zatca_settings',
      action: 'regenerate_credentials',
      changes: { vat_number: vatNumber, new_status: newStatus },
    });

    return new Response(JSON.stringify({
      success: true,
      status: newStatus,
      error: lastError,
      certificates_count: certs?.length || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
