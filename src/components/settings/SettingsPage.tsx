import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Lock, Globe, Loader2, Palette, Moon, Sun, Sparkles } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/theme/ThemeProvider";
import { RAMADAN_CONFIG, isCurrentlyRamadan } from "@/theme/tokens";


const SettingsPage = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const { mode, setMode, seasonalTheme, setSeasonalTheme, ramadanAutoOn, setRamadanAutoOn } = useTheme();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [fullNameEn, setFullNameEn] = useState(profile?.full_name_en || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title || "");
  const [language, setLanguage] = useState(profile?.language || "ar");
  const [timezone, setTimezone] = useState(profile?.timezone || "Asia/Riyadh");

  const isRamadanActive = seasonalTheme === "ramadan";
  const withinRamadanDates = isCurrentlyRamadan();

  const handleToggleRamadan = (checked: boolean) => {
    setSeasonalTheme(checked ? "ramadan" : "default");
    toast({
      title: checked ? "تم تفعيل ثيم رمضان 🌙" : "تم الرجوع للثيم الافتراضي",
      description: checked
        ? "يظهر الآن ثيم رمضان الخاص بالنظام"
        : "تم إيقاف ثيم رمضان والرجوع للمظهر الافتراضي",
    });
  };

  const handleToggleAutoRamadan = (checked: boolean) => {
    setRamadanAutoOn(checked);
    toast({
      title: checked ? "التفعيل التلقائي مفعّل" : "التفعيل التلقائي معطّل",
      description: checked
        ? `سيُفعَّل ثيم رمضان تلقائياً بين ${RAMADAN_CONFIG.ramadanStart} و ${RAMADAN_CONFIG.ramadanEnd}`
        : "لن يتغير الثيم تلقائياً — يمكنك التحكم يدوياً",
    });
  };



  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      full_name_en: fullNameEn,
      phone,
      job_title: jobTitle,
      language,
      timezone,
    }).eq("id", user.id);

    if (error) {
      toast({ title: "خطأ", description: "فشل في حفظ الإعدادات", variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم تحديث الإعدادات بنجاح" });
    }
    setSaving(false);
  };

  const sections = [
    {
      title: "الملف الشخصي",
      icon: User,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>الاسم الكامل (عربي)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الاسم الكامل (إنجليزي)</Label>
            <Input value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input value={profile?.email || ""} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label>رقم الجوال</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>المسمى الوظيفي</Label>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
        </div>
      ),
    },
    {
      title: "اللغة والمنطقة الزمنية",
      icon: Globe,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>اللغة</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المنطقة الزمنية</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Riyadh">الرياض (GMT+3)</SelectItem>
                <SelectItem value="Asia/Dubai">دبي (GMT+4)</SelectItem>
                <SelectItem value="Asia/Kuwait">الكويت (GMT+3)</SelectItem>
                <SelectItem value="Europe/London">لندن (GMT+0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      <PageHeader title="الإعدادات" description="إدارة حسابك الشخصي وتفضيلاتك" />

      {sections.map((section, i) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="flex items-center gap-2 mb-5">
            <section.icon size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          </div>
          {section.content}
        </motion.div>
      ))}

      {/* Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (sections.length + 1) * 0.1 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2 mb-5">
          <Palette size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-foreground">المظهر والثيم</h3>
        </div>

        <div className="space-y-5">
          {/* Dark/Light mode */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {mode === "dark" ? <Moon size={16} className="text-accent" /> : <Sun size={16} className="text-accent" />}
              <div>
                <p className="text-sm font-medium text-foreground">وضع المظهر</p>
                <p className="text-xs text-muted-foreground">{mode === "dark" ? "الوضع الداكن مفعّل" : "الوضع الفاتح مفعّل"}</p>
              </div>
            </div>
            <Switch
              checked={mode === "dark"}
              onCheckedChange={(v) => setMode(v ? "dark" : "light")}
            />
          </div>

          <div className="border-t border-border" />

          {/* Ramadan theme toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-base leading-none">🌙</span>
              <div>
                <p className="text-sm font-medium text-foreground">ثيم رمضان</p>
                <p className="text-xs text-muted-foreground">
                  {isRamadanActive ? "ثيم رمضان مفعّل حالياً" : "ثيم رمضان معطّل"}
                </p>
              </div>
            </div>
            <Switch
              checked={isRamadanActive}
              onCheckedChange={handleToggleRamadan}
            />
          </div>

          {/* Auto-activate during Ramadan */}
          <div
            className="flex items-center justify-between gap-4 rounded-lg px-4 py-3"
            style={{
              background: "hsl(var(--muted)/0.5)",
              opacity: isRamadanActive || ramadanAutoOn ? 1 : 0.6,
            }}
          >
            <div className="flex items-center gap-3">
              <Sparkles size={15} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">تفعيل تلقائي خلال رمضان</p>
                <p className="text-xs text-muted-foreground">
                  {withinRamadanDates
                    ? `الآن ضمن رمضان (${RAMADAN_CONFIG.ramadanStart} → ${RAMADAN_CONFIG.ramadanEnd})`
                    : `رمضان: ${RAMADAN_CONFIG.ramadanStart} ← ${RAMADAN_CONFIG.ramadanEnd}`}
                </p>
              </div>
            </div>
            <Switch
              checked={ramadanAutoOn}
              onCheckedChange={handleToggleAutoRamadan}
            />
          </div>

          {withinRamadanDates && (
            <p className="text-xs text-accent flex items-center gap-1.5">
              <span>🌙</span>
              نحن الآن في شهر رمضان المبارك — يمكن تفعيل الثيم تلقائياً.
            </p>
          )}
        </div>
      </motion.div>

      {/* Notification Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: sections.length * 0.1 }}
      >
        <NotificationPreferences />
      </motion.div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;

