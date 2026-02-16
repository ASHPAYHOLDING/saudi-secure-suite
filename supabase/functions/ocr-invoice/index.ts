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

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // Get tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("No tenant found");

    const { imageBase64, fileName, fileSize, mimeType } = await req.json();
    if (!imageBase64) throw new Error("No image data provided");

    // Call Lovable AI with vision
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
            content: `You are an Arabic invoice OCR specialist. Extract structured data from invoice images.
Focus on Arabic invoices first but also support English.
Extract: vendor name, vendor VAT number, vendor CR number, invoice number, invoice date, due date, currency, items (description, quantity, unit, unit_price, discount, vat_rate), subtotal, vat_total, grand_total, and any notes.
For dates, use YYYY-MM-DD format.
For numbers, use plain numeric values without formatting.
If a field cannot be found, return null for it.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all invoice data from this image. Return structured data using the extract_invoice_data tool.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extract structured invoice data from the image",
              parameters: {
                type: "object",
                properties: {
                  vendor_name: { type: "string", description: "Vendor/supplier company name" },
                  vendor_name_en: { type: "string", description: "Vendor name in English if available" },
                  vendor_vat_number: { type: "string", description: "Vendor VAT number" },
                  vendor_cr_number: { type: "string", description: "Vendor commercial registration number" },
                  vendor_address: { type: "string", description: "Vendor address" },
                  vendor_phone: { type: "string", description: "Vendor phone" },
                  vendor_email: { type: "string", description: "Vendor email" },
                  invoice_number: { type: "string", description: "Invoice number" },
                  invoice_date: { type: "string", description: "Invoice date in YYYY-MM-DD" },
                  due_date: { type: "string", description: "Due date in YYYY-MM-DD" },
                  currency: { type: "string", description: "Currency code (e.g. SAR)" },
                  customer_name: { type: "string", description: "Customer/buyer name" },
                  customer_vat_number: { type: "string", description: "Customer VAT number" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unit_price: { type: "number" },
                        discount: { type: "number" },
                        vat_rate: { type: "number" },
                      },
                      required: ["description", "quantity", "unit_price"],
                    },
                  },
                  subtotal: { type: "number" },
                  vat_total: { type: "number" },
                  grand_total: { type: "number" },
                  notes: { type: "string" },
                },
                required: ["vendor_name", "items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول مرة أخرى لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام خدمة OCR" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", status, errorText);
      throw new Error(`AI processing failed: ${status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let extractedData = null;
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error("Failed to parse AI response");
      }
    }

    if (!extractedData) throw new Error("No data extracted from image");

    const processingTime = Date.now() - startTime;

    // Log OCR usage
    await supabase.from("ocr_usage_logs").insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      file_name: fileName || "unknown",
      file_size_bytes: fileSize || 0,
      processing_time_ms: processingTime,
      status: "completed",
      model_used: "google/gemini-2.5-flash",
      extracted_data: extractedData,
    });

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OCR error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
