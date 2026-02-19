import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null, reported: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, reported: false });
  };

  handleReport = async () => {
    const { error } = this.state;
    if (!error) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Try to get tenant_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      await supabase.from("client_errors").insert({
        user_id: user.id,
        tenant_id: profile?.tenant_id ?? null,
        route: window.location.pathname,
        error_message: error.message,
        stack: error.stack?.slice(0, 4000) ?? null,
        device_info: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screen: `${screen.width}x${screen.height}`,
          timestamp: new Date().toISOString(),
        },
      });

      this.setState({ reported: true });
    } catch (e) {
      console.error("Failed to report error", e);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-background p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
          >
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              نعتذر عن هذا الخطأ. يمكنك إعادة المحاولة أو إرسال تقرير لفريق
              الدعم.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
            <Button
              variant="outline"
              onClick={this.handleReport}
              disabled={this.state.reported}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {this.state.reported ? "تم إرسال التقرير ✓" : "إرسال تقرير"}
            </Button>
          </div>

          {this.state.error && (
            <details className="text-start text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-4">
              <summary className="cursor-pointer font-medium mb-1">
                تفاصيل تقنية
              </summary>
              <pre
                dir="ltr"
                className="whitespace-pre-wrap break-all text-left mt-2 font-mono"
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
        </motion.div>
      </div>
    );
  }
}

export default GlobalErrorBoundary;
