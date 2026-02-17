import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ZATCA API endpoints
const ZATCA_SANDBOX_URL = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";
const ZATCA_PRODUCTION_URL = "https://gw-fatoora.zatca.gov.sa/e-invoicing/core";

interface InvoiceData {
  invoice: any;
  items: any[];
  tenant: any;
  customer: any;
}

function generateUBL21XML(data: InvoiceData): string {
  const { invoice, items, tenant, customer } = data;
  const invoiceUUID = invoice.invoice_uuid;
  const issueDate = invoice.invoice_date;
  const issueTime = "00:00:00";

  // Standard = 388 (tax invoice), Simplified = 388 (simplified tax invoice)
  const isSimplified = invoice.invoice_type === "simplified";
  const invoiceTypeCode = "388";
  const subTypeCode = isSimplified ? "0200000" : "0100000";

  const lineItems = items.map((item: any, idx: number) => `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${item.unit === 'وحدة' ? 'PCE' : 'PCE'}">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${(item.unit_price * item.quantity - (item.discount || 0)).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(item.vat_amount || 0).toFixed(2)}</cbc:TaxAmount>
        <cbc:RoundingAmount currencyID="SAR">${(item.line_total || 0).toFixed(2)}</cbc:RoundingAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${escapeXml(item.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>${item.vat_rate || 15}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${(item.unit_price || 0).toFixed(2)}</cbc:PriceAmount>
        ${item.discount > 0 ? `
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
          <cbc:Amount currencyID="SAR">${(item.discount || 0).toFixed(2)}</cbc:Amount>
        </cac:AllowanceCharge>` : ''}
      </cac:Price>
    </cac:InvoiceLine>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:UUID>${invoiceUUID}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subTypeCode}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  ${invoice.previous_invoice_hash ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>PIH</cbc:ID>
      <cac:Attachment>
        <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${invoice.previous_invoice_hash}</cbc:EmbeddedDocumentBinaryObject>
      </cac:Attachment>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>` : ''}
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${invoice.id}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${escapeXml(tenant.cr_number || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(tenant.address_street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(tenant.address_city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(tenant.address_zip || '00000')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(tenant.vat_number || '')}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      ${customer?.vat_number ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(customer.vat_number)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>` : ''}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(customer?.name || '')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(customer?.address_street || '')}</cbc:StreetName>
        <cbc:CityName>${escapeXml(customer?.address_city || '')}</cbc:CityName>
        <cac:Country>
          <cbc:IdentificationCode>SA</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(invoice.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${(invoice.subtotal || 0).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${(invoice.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${(invoice.vat_total || 0).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${(invoice.subtotal || 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${(invoice.subtotal || 0).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${(invoice.grand_total || 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${(invoice.discount_total || 0).toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="SAR">${(invoice.amount_due || invoice.grand_total || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineItems}
</Invoice>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function hashInvoice(xml: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(xml);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

async function submitToZATCA(xml: string, hash: string, uuid: string, tenant: any, invoiceType: string): Promise<any> {
  const isProduction = tenant.zatca_environment === "production";
  const baseUrl = isProduction ? ZATCA_PRODUCTION_URL : ZATCA_SANDBOX_URL;
  const csid = isProduction ? tenant.zatca_production_csid : tenant.zatca_compliance_csid;

  if (!csid) {
    return { status: "error", message: "لم يتم تكوين شهادة ZATCA (CSID). يرجى إعدادها في صفحة الامتثال." };
  }

  const invoiceBody = btoa(xml);

  // Standard invoices → clearance, Simplified → reporting
  const isSimplified = invoiceType === "simplified";
  const endpoint = isSimplified
    ? `${baseUrl}/invoices/reporting/single`
    : `${baseUrl}/invoices/clearance/single`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Accept-Language": "ar",
        "Accept-Version": "V2",
        "Authorization": `Basic ${csid}`,
        ...(isSimplified ? {} : { "Clearance-Status": "1" }),
      },
      body: JSON.stringify({
        invoiceHash: hash,
        uuid: uuid,
        invoice: invoiceBody,
      }),
    });

    const result = await response.json();
    return {
      status: response.ok ? "success" : "error",
      httpStatus: response.status,
      reportingStatus: result.reportingStatus || null,
      clearanceStatus: result.clearanceStatus || null,
      validationResults: result.validationResults || null,
      warnings: result.validationResults?.warningMessages || [],
      errors: result.validationResults?.errorMessages || [],
      raw: result,
    };
  } catch (err: any) {
    return { status: "error", message: err.message || "فشل الاتصال ببوابة ZATCA" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // ✅ Fixed: Use getUser() instead of deprecated getClaims()
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, invoiceId } = await req.json();

    if (action === "generate-xml") {
      // Fetch invoice with related data
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(name, name_en, vat_number, cr_number, address_street, address_city, address_zip, phone, email)")
        .eq("id", invoiceId)
        .single();
      if (invErr || !invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort_order");

      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", invoice.tenant_id)
        .single();

      if (!tenant) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get previous invoice hash for chaining
      const { data: prevInvoice } = await supabase
        .from("invoices")
        .select("invoice_hash")
        .eq("tenant_id", invoice.tenant_id)
        .lt("created_at", invoice.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousHash = prevInvoice?.invoice_hash || btoa("0".repeat(32));

      const xml = generateUBL21XML({
        invoice: { ...invoice, previous_invoice_hash: previousHash },
        items: items || [],
        tenant,
        customer: invoice.customers,
      });

      const invoiceHash = await hashInvoice(xml);

      // Save XML and hash to invoice
      await supabase.from("invoices").update({
        zatca_xml: xml,
        invoice_hash: invoiceHash,
        previous_invoice_hash: previousHash,
        zatca_status: "xml_generated",
      }).eq("id", invoiceId);

      return new Response(JSON.stringify({
        success: true,
        xml,
        hash: invoiceHash,
        uuid: invoice.invoice_uuid,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "submit-to-zatca") {
      // ✅ Mutex: Check if already submitted or in-progress
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (!invoice?.zatca_xml || !invoice?.invoice_hash) {
        return new Response(JSON.stringify({ error: "يجب إنشاء XML أولاً" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ✅ Prevent duplicate submission — only allow from xml_generated or failed
      if (invoice.zatca_status === "reported" || invoice.zatca_status === "cleared") {
        return new Response(JSON.stringify({ 
          error: "تم إرسال هذه الفاتورة مسبقاً لبوابة ZATCA ولا يمكن إعادة الإرسال",
          zatca_status: invoice.zatca_status 
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (invoice.zatca_status !== "xml_generated" && invoice.zatca_status !== "failed") {
        return new Response(JSON.stringify({ 
          error: "حالة الفاتورة لا تسمح بالإرسال. يجب توليد XML أولاً." 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ✅ Optimistic lock: set status to "submitting" to prevent race conditions
      const { data: locked, error: lockErr } = await supabase
        .from("invoices")
        .update({ zatca_status: "submitting" })
        .eq("id", invoiceId)
        .in("zatca_status", ["xml_generated", "failed"])
        .select("id")
        .single();

      if (lockErr || !locked) {
        return new Response(JSON.stringify({ 
          error: "الفاتورة قيد الإرسال حالياً من مستخدم آخر" 
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", invoice.tenant_id)
        .single();

      // ✅ Fixed: Route to correct endpoint based on invoice type
      const result = await submitToZATCA(
        invoice.zatca_xml,
        invoice.invoice_hash,
        invoice.invoice_uuid,
        tenant,
        invoice.invoice_type
      );

      // Determine final status based on invoice type and result
      let finalStatus = "failed";
      if (result.status === "success") {
        const isSimplified = invoice.invoice_type === "simplified";
        finalStatus = isSimplified ? "reported" : "cleared";
      }

      // Update invoice with ZATCA response
      await supabase.from("invoices").update({
        zatca_status: finalStatus,
        zatca_clearance_status: result.clearanceStatus || null,
        zatca_reporting_status: result.reportingStatus || null,
        zatca_warnings: result.warnings || [],
        zatca_errors: result.errors || [],
        zatca_submitted_at: new Date().toISOString(),
        zatca_response: result.raw || null,
      }).eq("id", invoiceId);

      return new Response(JSON.stringify({
        success: result.status === "success",
        result,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("ZATCA error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
