import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { supplierInvoiceId } = await req.json();
    if (!supplierInvoiceId) throw new Error("Missing supplierInvoiceId");

    // Get the supplier invoice record
    const { data: invoice, error: fetchErr } = await supabase
      .from("supplier_invoices")
      .select("*")
      .eq("id", supplierInvoiceId)
      .single();

    if (fetchErr || !invoice) throw new Error("Supplier invoice not found");

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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
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

    const spamScore = extracted.spam_score ?? 0;
    const isSpam = spamScore > 0.7;

    await supabase
      .from("supplier_invoices")
      .update({
        ocr_status: "completed",
        ocr_data: extracted,
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

    return new Response(JSON.stringify({ success: true, data: extracted, is_spam: isSpam }), {
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
