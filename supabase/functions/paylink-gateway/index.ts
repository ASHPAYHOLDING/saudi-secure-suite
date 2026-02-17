import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYLINK_BASE_URL = "https://restapi.paylink.sa";

// ─── helpers ────────────────────────────────────────────────────────
async function paylinkAuth(): Promise<string> {
  const apiId = Deno.env.get("PAYLINK_API_ID");
  const secretKey = Deno.env.get("PAYLINK_SECRET_KEY");
  if (!apiId || !secretKey) throw new Error("Paylink credentials not configured");

  const res = await fetch(`${PAYLINK_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiId, secretKey, persistToken: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paylink auth failed: ${res.status} – ${text}`);
  }

  const data = await res.json();
  return data.id_token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Get user's tenant
    const { data: memberData } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!memberData) {
      return jsonResponse({ error: "No tenant found" }, 403);
    }
    const tenantId = memberData.tenant_id;

    // ─── ACTION: create-invoice ─────────────────────────────────
    if (action === "create-invoice" && req.method === "POST") {
      const body = await req.json();
      const {
        amount,
        clientName,
        clientMobile,
        clientEmail,
        orderNumber,
        callBackUrl,
        note,
        products,
      } = body;

      if (!amount || !clientName || !clientMobile || !orderNumber) {
        return jsonResponse({ error: "Missing required fields: amount, clientName, clientMobile, orderNumber" }, 400);
      }

      // Authenticate with Paylink
      const paylinkToken = await paylinkAuth();

      // Build products array
      const paylinkProducts = products && products.length > 0
        ? products.map((p: any) => ({
            title: p.title || p.description || "منتج",
            price: p.price || p.unit_price || 0,
            qty: p.qty || p.quantity || 1,
            description: p.description || "",
            isDigital: false,
            imageSrc: null,
            specificVat: null,
            productCost: null,
          }))
        : [{ title: "دفعة", price: amount, qty: 1 }];

      // Create invoice via Paylink
      const invoiceRes = await fetch(`${PAYLINK_BASE_URL}/api/addInvoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${paylinkToken}`,
        },
        body: JSON.stringify({
          amount,
          callBackUrl: callBackUrl || "",
          clientEmail: clientEmail || "",
          clientMobile,
          clientName,
          currency: "SAR",
          note: note || "",
          orderNumber,
          products: paylinkProducts,
        }),
      });

      if (!invoiceRes.ok) {
        const errText = await invoiceRes.text();
        console.error("Paylink addInvoice error:", errText);
        return jsonResponse({ error: "Failed to create Paylink invoice", details: errText }, 502);
      }

      const invoiceData = await invoiceRes.json();

      // Store transaction in our DB
      const txNum = `PL-${invoiceData.transactionNo || Date.now()}`;
      const { data: txData, error: txError } = await supabase
        .from("paylink_transactions")
        .insert({
          tenant_id: tenantId,
          transaction_number: txNum,
          transaction_type: "deposit",
          description: `فاتورة دفع: ${clientName} – ${orderNumber}`,
          gross_amount: amount,
          fee_amount: 0,
          net_amount: amount,
          status: "pending",
          payment_method: "paylink",
          created_by: userId,
          paylink_transaction_no: invoiceData.transactionNo || null,
        })
        .select()
        .single();

      if (txError) {
        console.error("DB insert error:", txError);
      }

      return jsonResponse({
        success: true,
        transactionNo: invoiceData.transactionNo,
        paymentUrl: invoiceData.url,
        checkUrl: invoiceData.checkUrl,
        qrUrl: invoiceData.qrUrl,
        mobileUrl: invoiceData.mobileUrl,
        localTransaction: txData,
      });
    }

    // ─── ACTION: check-status ───────────────────────────────────
    if (action === "check-status") {
      const transactionNo = url.searchParams.get("transactionNo");
      if (!transactionNo) {
        return jsonResponse({ error: "transactionNo is required" }, 400);
      }

      const paylinkToken = await paylinkAuth();

      const statusRes = await fetch(
        `${PAYLINK_BASE_URL}/api/getInvoice/${transactionNo}`,
        {
          headers: { Authorization: `Bearer ${paylinkToken}` },
        }
      );

      if (!statusRes.ok) {
        const errText = await statusRes.text();
        return jsonResponse({ error: "Failed to check status", details: errText }, 502);
      }

      const statusData = await statusRes.json();

      // Update our transaction if payment completed
      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        await supabase
          .from("paylink_transactions")
          .update({ status: "completed", payment_method: statusData.paymentMethod || "paylink" })
          .eq("tenant_id", tenantId)
          .eq("paylink_transaction_no", transactionNo);
      } else if (statusData.orderStatus === "Canceled" || statusData.orderStatus === "canceled") {
        await supabase
          .from("paylink_transactions")
          .update({ status: "failed" })
          .eq("tenant_id", tenantId)
          .eq("paylink_transaction_no", transactionNo);
      }

      return jsonResponse({
        orderStatus: statusData.orderStatus,
        paymentMethod: statusData.paymentMethod,
        amount: statusData.amount,
        transactionNo: statusData.transactionNo,
        orderNumber: statusData.orderNumber,
      });
    }

    // ─── ACTION: cancel-invoice ─────────────────────────────────
    if (action === "cancel-invoice" && req.method === "POST") {
      const body = await req.json();
      const { transactionNo } = body;
      if (!transactionNo) {
        return jsonResponse({ error: "transactionNo is required" }, 400);
      }

      const paylinkToken = await paylinkAuth();

      const cancelRes = await fetch(
        `${PAYLINK_BASE_URL}/api/cancelInvoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${paylinkToken}`,
          },
          body: JSON.stringify({ transactionNo }),
        }
      );

      const cancelData = await cancelRes.json();

      // Update local status
      await supabase
        .from("paylink_transactions")
        .update({ status: "failed" })
        .eq("tenant_id", tenantId)
        .eq("paylink_transaction_no", transactionNo);

      return jsonResponse({ success: true, ...cancelData });
    }

    // ─── ACTION: callback (webhook) ─────────────────────────────
    if (action === "callback" && req.method === "POST") {
      // This endpoint can be called by Paylink after payment
      const body = await req.json();
      const { transactionNo, orderStatus } = body;

      if (transactionNo) {
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        if (orderStatus === "Paid" || orderStatus === "paid") {
          await serviceClient
            .from("paylink_transactions")
            .update({ status: "completed" })
            .eq("paylink_transaction_no", transactionNo);
        } else if (orderStatus === "Canceled" || orderStatus === "canceled") {
          await serviceClient
            .from("paylink_transactions")
            .update({ status: "failed" })
            .eq("paylink_transaction_no", transactionNo);
        }
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("paylink-gateway error:", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
