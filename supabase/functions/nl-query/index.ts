import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_SCHEMA = `
Available tables and columns (all have tenant_id for RLS):

invoices: id, invoice_number, invoice_date, due_date, status (draft|sent|paid|overdue|cancelled), 
  customer_id, subtotal, vat_total, discount_total, grand_total, amount_paid, amount_due, 
  currency (SAR), invoice_type, notes, created_at

invoice_items: id, invoice_id, description, quantity, unit_price, discount, vat_rate, vat_amount, line_total

customers: id, name, name_en, email, phone, customer_type (business|individual), 
  vat_number, cr_number, address_city, tags, is_active

expenses: id, expense_number, title, description, amount, vat_rate, vat_amount, total_amount, 
  expense_date, status (draft|pending|approved|rejected), payment_method, category_id, created_at

expense_categories: id, name, name_en, is_active

products: id, name, name_en, sku, unit_price, cost_price, stock_quantity, low_stock_threshold, 
  is_active, track_stock, category

quotations: id, quotation_number, quotation_date, valid_until, status (draft|sent|approved|rejected|converted|expired), 
  customer_id, subtotal, vat_total, grand_total

sales_orders: id, order_number, order_date, status, fulfillment_status, customer_id, grand_total

purchase_orders: id, order_number, order_date, status, delivery_status, supplier_id, grand_total

suppliers: id, name, email, phone, is_active

contracts: id, contract_number, title, status, total_value, start_date, end_date, customer_id
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const rlClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const blocked = await checkRateLimit(req, rlClient, "nl_query", corsHeaders);
    if (blocked) return blocked;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرّح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth token for RLS
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "غير مصرّح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.length > 500) {
      return new Response(JSON.stringify({ error: "الرجاء إدخال استعلام صالح (حتى 500 حرف)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Use AI to parse the natural language query into a structured query
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a database query parser for an Arabic/English accounting platform.
Given a natural language question, extract a structured query object.

${TABLES_SCHEMA}

RULES:
- Only SELECT operations allowed. Never modify data.
- Output ONLY a JSON object with this exact schema, no extra text:
{
  "table": "table_name",
  "select": "column1, column2, ...",
  "filters": [{"column": "col", "operator": "eq|gt|gte|lt|lte|like|ilike|neq|in|is", "value": "..."}],
  "order": {"column": "col", "ascending": true|false},
  "limit": 50,
  "joins": [{"table": "related_table", "select": "col1, col2", "fk": "foreign_key_column"}],
  "explanation_ar": "شرح قصير بالعربية لما سيتم عرضه",
  "explanation_en": "Short English explanation of what will be shown"
}

- For "unpaid invoices" use status filter neq "paid" and neq "cancelled" and neq "draft"
- For "overdue" use due_date lt today's date AND status not paid/cancelled
- For customer names, join with customers table
- For expense categories, join with expense_categories table  
- Always include reasonable defaults: limit 50, order by created_at desc
- For amount queries: use grand_total for invoices/quotations/orders, total_amount for expenses
- "فوق" or "أكثر من" or "above" means gt/gte
- "أقل من" or "below" means lt/lte
- Today's date is: ${new Date().toISOString().split("T")[0]}`,
          },
          { role: "user", content: query },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "execute_query",
              description: "Execute a structured database query",
              parameters: {
                type: "object",
                properties: {
                  table: { type: "string" },
                  select: { type: "string" },
                  filters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        column: { type: "string" },
                        operator: { type: "string", enum: ["eq", "gt", "gte", "lt", "lte", "like", "ilike", "neq", "in", "is"] },
                        value: {},
                      },
                      required: ["column", "operator", "value"],
                    },
                  },
                  order: {
                    type: "object",
                    properties: {
                      column: { type: "string" },
                      ascending: { type: "boolean" },
                    },
                  },
                  limit: { type: "number" },
                  joins: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        table: { type: "string" },
                        select: { type: "string" },
                        fk: { type: "string" },
                      },
                    },
                  },
                  explanation_ar: { type: "string" },
                  explanation_en: { type: "string" },
                },
                required: ["table", "select", "filters", "explanation_ar"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "execute_query" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "لم أفهم السؤال، حاول صياغته بطريقة مختلفة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Step 2: Build and execute the safe Supabase query
    const ALLOWED_TABLES = [
      "invoices", "invoice_items", "customers", "expenses", "expense_categories",
      "products", "quotations", "sales_orders", "purchase_orders", "suppliers",
      "contracts", "delivery_notes",
    ];

    if (!ALLOWED_TABLES.includes(parsed.table)) {
      return new Response(JSON.stringify({ error: "جدول غير مدعوم" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forbid AI from manipulating sensitive system columns — RLS owns tenant_id scoping
    const FORBIDDEN_COLS = new Set(["tenant_id", "user_id", "created_by", "owner_id"]);

    // Build select with joins (max depth 3)
    let selectStr = parsed.select || "*";
    if (parsed.joins?.length) {
      const safeJoins = parsed.joins.slice(0, 3);
      for (const join of safeJoins) {
        if (ALLOWED_TABLES.includes(join.table)) {
          const joinSelect = String(join.select || "*").replace(/[^a-zA-Z0-9_,\s*]/g, "");
          selectStr += `, ${join.table}(${joinSelect})`;
        }
      }
    }

    let q = supabase.from(parsed.table).select(selectStr);

    // Apply filters (cap to 10, drop forbidden columns)
    if (parsed.filters?.length) {
      const safeFilters = parsed.filters.slice(0, 10);
      for (const f of safeFilters) {
        const col = String(f.column).replace(/[^a-zA-Z0-9_.]/g, "");
        if (!col || FORBIDDEN_COLS.has(col.split(".")[0])) {
          console.warn("[nl-query] dropped forbidden filter column:", f.column);
          continue;
        }
        switch (f.operator) {
          case "eq": q = q.eq(col, f.value); break;
          case "neq": q = q.neq(col, f.value); break;
          case "gt": q = q.gt(col, f.value); break;
          case "gte": q = q.gte(col, f.value); break;
          case "lt": q = q.lt(col, f.value); break;
          case "lte": q = q.lte(col, f.value); break;
          case "like": q = q.like(col, `%${f.value}%`); break;
          case "ilike": q = q.ilike(col, `%${f.value}%`); break;
          case "in": q = q.in(col, Array.isArray(f.value) ? f.value.slice(0, 100) : [f.value]); break;
          case "is": q = q.is(col, f.value); break;
          default:
            console.warn("[nl-query] unsupported operator:", f.operator);
        }
      }
    }

    // Apply order
    if (parsed.order?.column) {
      const orderCol = String(parsed.order.column).replace(/[^a-zA-Z0-9_.]/g, "");
      q = q.order(orderCol, { ascending: parsed.order.ascending ?? false });
    }

    // Apply limit
    q = q.limit(Math.min(parsed.limit || 50, 100));

    const { data, error } = await q;
    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: "خطأ في تنفيذ الاستعلام: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        results: data || [],
        count: data?.length || 0,
        explanation_ar: parsed.explanation_ar,
        explanation_en: parsed.explanation_en,
        query_info: {
          table: parsed.table,
          filters: parsed.filters,
          order: parsed.order,
          limit: parsed.limit,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("nl-query error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
