import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SsoLoginButtonProps {
  onBack?: () => void;
}

export const SsoLoginButton = ({ onBack }: SsoLoginButtonProps) => {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSsoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast({ title: "خطأ", description: "يرجى إدخال بريد إلكتروني صالح", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sso-init", {
        body: { email },
      });

      if (error) throw error;

      if (!data.sso_available) {
        toast({
          title: "غير متاح",
          description: "لا يوجد تسجيل دخول مؤسسي مُعدّ لهذا النطاق. يرجى استخدام البريد وكلمة المرور.",
          variant: "destructive",
        });
        return;
      }

      // Redirect to SSO provider
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "حدث خطأ أثناء بدء تسجيل الدخول المؤسسي", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all"
        onClick={() => setExpanded(true)}
      >
        <Building2 size={18} />
        تسجيل دخول مؤسسي (SSO)
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => { setExpanded(false); onBack?.(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 size={16} className="text-accent" />
          تسجيل دخول مؤسسي
        </h3>
      </div>

      <form onSubmit={handleSsoLogin} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sso-email" className="text-xs text-muted-foreground">
            أدخل بريدك المؤسسي
          </Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              id="sso-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pr-10 text-sm"
              dir="ltr"
              autoFocus
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin ml-2" />
              جارٍ التحقق...
            </>
          ) : (
            "متابعة بالدخول المؤسسي"
          )}
        </Button>
      </form>

      <p className="text-[11px] text-muted-foreground/60 text-center">
        سيتم توجيهك لمزود الهوية الخاص بمنشأتك
      </p>
    </motion.div>
  );
};
