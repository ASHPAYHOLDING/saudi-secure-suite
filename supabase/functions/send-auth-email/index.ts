import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type, redirectTo } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client to generate the verification link
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailType = type === "recovery" ? "recovery" : "signup";
    const redirect = redirectTo || "https://numaxio.com";

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: emailType,
        email,
        options: { redirectTo: redirect },
      });

    if (linkError) {
      console.error("Generate link error:", linkError);
      return new Response(
        JSON.stringify({ error: linkError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      return new Response(
        JSON.stringify({ error: "Failed to generate verification link" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build email HTML
    let subject: string;
    let htmlBody: string;

    if (emailType === "signup") {
      subject = "تأكيد حسابك في Numaxio";
      htmlBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">مرحباً بك في Numaxio</h1>
            </div>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.8;">
              شكراً لتسجيلك! يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${actionLink}" 
                 style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
                تأكيد البريد الإلكتروني
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; text-align: center;">
              إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.
            </p>
          </div>
          <p style="color: #a0aec0; font-size: 12px; text-align: center; margin-top: 24px;">
            © Numaxio - نظام إدارة الأعمال
          </p>
        </div>
      `;
    } else {
      subject = "إعادة تعيين كلمة المرور - Numaxio";
      htmlBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">إعادة تعيين كلمة المرور</h1>
            </div>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.8;">
              تلقينا طلباً لإعادة تعيين كلمة المرور. اضغط على الزر أدناه:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${actionLink}" 
                 style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
                إعادة تعيين كلمة المرور
              </a>
            </div>
            <p style="color: #718096; font-size: 14px; text-align: center;">
              إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.
            </p>
          </div>
          <p style="color: #a0aec0; font-size: 12px; text-align: center; margin-top: 24px;">
            © Numaxio - نظام إدارة الأعمال
          </p>
        </div>
      `;
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Numaxio <noreply@numaxio.com>",
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const resData = await res.json();
    console.log("Resend response:", JSON.stringify(resData));

    if (!res.ok) {
      console.error("Resend error:", resData);
      return new Response(JSON.stringify({ error: resData }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-auth-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
