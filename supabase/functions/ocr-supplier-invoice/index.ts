import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safe base64 encoding for large files (avoids stack overflow from spread operator)
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// Validate VAT consistency: subtotal * 0.15 should ≈ vat_amount (within 5% tolerance)
function validateVat(extracted: any): { valid: boolean; warning?: string } {
  const subtotal = extracted.subtotal;
  const vatAmount = extracted.vat_amount;
  const totalAmount = extracted.total_amount;

  if (!subtotal || !vatAmount) return { valid: true };

  const expectedVat = subtotal * 0.15;
  const tolerance = expectedVat * 0.05; // 5% tolerance for rounding
  if (Math.abs(vatAmount - expectedVat) > tolerance && expectedVat > 0) {
    return {
      valid: false,
      warning: `VAT mismatch: expected ~${expectedVat.toFixed(2)} (15% of ${subtotal}), got ${vatAmount}`,
    };
  }

  // Also check total = subtotal + vat
  if (totalAmount && subtotal && vatAmount) {
    const expectedTotal = subtotal + vatAmount;
    if (Math.abs(totalAmount - expectedTotal) > expectedTotal * 0.02) {
      return {
        valid: false,
        warning: `Total mismatch: subtotal(${subtotal}) + VAT(${vatAmount}) = ${expectedTotal}, but total = ${totalAmount}`,
      };
    }
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlClient, "ocr", corsHeaders);
    if (blocked) return blocked;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user identity
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // Get user's tenant for isolation check
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("No tenant found for user");

    const { supplierInvoiceId } = await req.json();
    if (!supplierInvoiceId) throw new Error("Missing supplierInvoiceId");

    // Get the supplier invoice record
    const { data: invoice, error: fetchErr } = await supabase
      .from("supplier_invoices")
      .select("*")
      .eq("id", supplierInvoiceId)
      .single();

    if (fetchErr || !invoice) throw new Error("Supplier invoice not found");

    // CRITICAL: Multi-tenant isolation check
    if (invoice.tenant_id !== profile.tenant_id) {
      console.error(`Tenant isolation violation: user tenant ${profile.tenant_id} tried to access invoice in tenant ${invoice.tenant_id}`);
      throw new Error("Unauthorized: cross-tenant access denied");
    }

    // Update status to processing
    await supabase
      .from("supplier_invoices")
      .update({ ocr_status: "processing" })
      .eq("id", supplierInvoiceId);

    // Download the file to get base64
    const fileUrl = invoice.file_url;
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("supplier-invoices")
      .download(fileUrl);

    if (dlErr || !fileData) {
      await supabase
        .from("supplier_invoices")
        .update({ ocr_status: "failed", ocr_error: "Failed to download file" })
        .eq("id", supplierInvoiceId);
      throw new Error("Failed to download file");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // File size check (max 10MB for OCR processing)
    if (bytes.length > 10 * 1024 * 1024) {
      await supabase
        .from("supplier_invoices")
        .update({ ocr_status: "failed", ocr_error: "File too large for OCR (max 10MB)" })
        .eq("id", supplierInvoiceId);
      throw new Error("File too large for OCR processing");
    }

    const base64 = uint8ToBase64(bytes);
    const mimeType = invoice.file_name.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

    // Call AI for OCR
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an Arabic supplier invoice OCR specialist. Extract structured data from supplier invoice images/PDFs.
Focus on Arabic invoices first but also support English.
Extract: supplier name, supplier VAT number, invoice number, invoice date, due date, currency, subtotal, vat amount, total amount, description/notes.
For dates, use YYYY-MM-DD format. For numbers, use plain numeric values.
VAT in Saudi Arabia is 15%. Validate that vat_amount ≈ subtotal * 0.15 when both are available.
Also assess spam likelihood: 0.0 = legitimate invoice, 1.0 = spam/irrelevant document.
If a field cannot be found, return null.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all supplier invoice data from this document." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_supplier_invoice",
              description: "Extract structured supplier invoice data",
              parameters: {
                type: "object",
                properties: {
                  supplier_name: { type: "string" },
                  supplier_vat_number: { type: "string" },
                  invoice_number: { type: "string" },
                  invoice_date: { type: "string", description: "YYYY-MM-DD" },
                  due_date: { type: "string", description: "YYYY-MM-DD" },
                  currency: { type: "string" },
                  subtotal: { type: "number" },
                  vat_amount: { type: "number" },
                  total_amount: { type: "number" },
                  description: { type: "string" },
                  spam_score: { type: "number", description: "0.0 legitimate - 1.0 spam" },
                },
                required: ["supplier_name"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_supplier_invoice" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      await supabase
        .from("supplier_invoices")
        .update({ ocr_status: "failed", ocr_error: `AI error: ${aiResponse.status}` })
        .eq("id", supplierInvoiceId);
      throw new Error(`AI processing failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let extracted = null;
    if (toolCall?.function?.arguments) {
      try { extracted = JSON.parse(toolCall.function.arguments); } catch { /* ignore */ }
    }

    if (!extracted) {
      await supabase
        .from("supplier_invoices")
        .update({ ocr_status: "failed", ocr_error: "No data extracted" })
        .eq("id", supplierInvoiceId);
      throw new Error("No data extracted");
    }

    // VAT validation
    const vatCheck = validateVat(extracted);
    if (!vatCheck.valid) {
      console.warn(`VAT validation warning for invoice ${supplierInvoiceId}: ${vatCheck.warning}`);
    }

    const spamScore = extracted.spam_score ?? 0;
    const isSpam = spamScore > 0.7;

    await supabase
      .from("supplier_invoices")
      .update({
        ocr_status: "completed",
        ocr_data: {
          ...extracted,
          vat_validation: vatCheck.valid ? "passed" : vatCheck.warning,
        },
        supplier_name: extracted.supplier_name || null,
        supplier_vat_number: extracted.supplier_vat_number || null,
        invoice_number: extracted.invoice_number || null,
        invoice_date: extracted.invoice_date || null,
        due_date: extracted.due_date || null,
        subtotal: extracted.subtotal || 0,
        vat_amount: extracted.vat_amount || 0,
        total_amount: extracted.total_amount || 0,
        currency: extracted.currency || "SAR",
        description: extracted.description || null,
        spam_score: spamScore,
        is_spam: isSpam,
      })
      .eq("id", supplierInvoiceId);

    return new Response(JSON.stringify({
      success: true,
      data: extracted,
      is_spam: isSpam,
      vat_validation: vatCheck,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OCR supplier invoice error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
