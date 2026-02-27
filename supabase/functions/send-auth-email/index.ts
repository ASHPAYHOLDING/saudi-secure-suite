import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

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
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting + parse body in parallel
    const bodyPromise = req.clone().json();
    const rlPromise = checkRateLimit(req, supabaseAdmin, "auth", corsHeaders);
    const [body, blocked] = await Promise.all([bodyPromise, rlPromise]);
    if (blocked) return blocked;

    const { email, type, redirectTo, otp } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Verify OTP ---
    if (type === "verify_otp") {
      if (!otp) {
        return new Response(JSON.stringify({ error: "OTP is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) {
        console.error("OTP verification error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, session: data.session }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Send OTP for signup ---
    if (type === "signup") {
      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP using Supabase admin - generate a magic link which also sets the OTP
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "signup",
          email,
          options: { redirectTo: redirectTo || "https://numaxio.com" },
        });

      if (linkError) {
        console.error("Generate link error:", linkError);
        return new Response(JSON.stringify({ error: linkError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract the OTP from the generated link properties
      const generatedOtp = linkData?.properties?.email_otp;
      const codeToSend = generatedOtp || otpCode;

      // Send OTP email via Resend
      const subject = "رمز التحقق - Numaxio";
      const htmlBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f8fafc;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">مرحباً بك في Numaxio</h1>
            </div>
            <p style="color: #4a5568; font-size: 16px; line-height: 1.8; text-align: center;">
              رمز التحقق الخاص بك هو:
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px 40px; border-radius: 16px; display: inline-block; letter-spacing: 12px; font-size: 36px; font-weight: 700; font-family: monospace;">
                ${codeToSend}
              </div>
            </div>
            <p style="color: #718096; font-size: 14px; text-align: center; line-height: 1.8;">
              أدخل هذا الرمز في صفحة التسجيل لتأكيد حسابك.<br/>
              الرمز صالح لمدة محدودة.
            </p>
            <p style="color: #a0aec0; font-size: 13px; text-align: center; margin-top: 24px;">
              إذا لم تقم بإنشاء حساب، يمكنك تجاهل هذه الرسالة.
            </p>
          </div>
          <p style="color: #a0aec0; font-size: 12px; text-align: center; margin-top: 24px;">
            © Numaxio - نظام إدارة الأعمال
          </p>
        </div>
      `;

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
    }

    // --- Recovery (password reset) ---
    if (type === "recovery") {
      const redirect = redirectTo || "https://numaxio.com";
      
      // Retry up to 2 times for transient SSL/network errors
      let linkData, linkError;
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: redirect },
        });
        linkData = result.data;
        linkError = result.error;
        if (!linkError) break;
        const errMsg = linkError.message || "";
        if (errMsg.includes("DOCTYPE") || errMsg.includes("SSL") || errMsg.includes("handshake") || errMsg.includes("not valid JSON")) {
          console.warn(`Recovery generateLink attempt ${attempt + 1} failed (transient), retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break; // Non-transient error, don't retry
      }

      if (linkError) {
        console.error("Generate link error:", linkError);
        return new Response(JSON.stringify({ error: "حدث خطأ مؤقت، يرجى المحاولة مرة أخرى" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const actionLink = linkData?.properties?.action_link;
      if (!actionLink) {
        return new Response(JSON.stringify({ error: "Failed to generate reset link" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const subject = "إعادة تعيين كلمة المرور - Numaxio";
      const htmlBody = `
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
      if (!res.ok) {
        return new Response(JSON.stringify({ error: resData }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
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
