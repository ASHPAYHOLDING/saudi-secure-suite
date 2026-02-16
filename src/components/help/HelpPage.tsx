import { motion } from "framer-motion";
import { HelpCircle, Book, MessageCircle, Mail, ExternalLink, FileText, Shield, CreditCard } from "lucide-react";

const helpSections = [
  {
    title: "البدء السريع",
    icon: Book,
    items: [
      "أنشئ حسابك وأكمل بيانات المنشأة من إعدادات الشركة",
      "أضف العملاء من قسم العملاء",
      "ابدأ بإنشاء الفواتير والعقود",
      "راجع التقارير والتحليلات لمتابعة الأداء",
    ],
  },
  {
    title: "إدارة الفواتير",
    icon: CreditCard,
    items: [
      "إنشاء فاتورة ضريبية متوافقة مع هيئة الزكاة والضريبة والجمارك",
      "إدارة حالات الفاتورة: مسودة، مرسلة، مدفوعة، ملغاة",
      "تصدير الفواتير بصيغة PDF مع رمز QR",
      "متابعة الفواتير المتأخرة من لوحة التحكم",
    ],
  },
  {
    title: "العقود والتوقيع",
    icon: FileText,
    items: [
      "إنشاء عقود من القوالب الجاهزة أو من الصفر",
      "إدارة إصدارات العقد وتتبع التغييرات",
      "توقيع العقود إلكترونياً",
      "ربط العقود بالعملاء لتتبع شامل",
    ],
  },
  {
    title: "الأمان والامتثال",
    icon: Shield,
    items: [
      "نظام صلاحيات متعدد المستويات (مالك، مدير، محاسب، عضو)",
      "سجل مراجعة كامل لجميع العمليات",
      "تشفير البيانات وحماية المعلومات",
      "توافق مع المرحلة الأولى من فوترة زاتكا",
    ],
  },
];

const HelpPage = () => {
  return (
    <div dir="rtl" className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المساعدة والدعم</h1>
        <p className="text-sm text-muted-foreground">دليل استخدام النظام والأسئلة الشائعة</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {helpSections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <section.icon size={18} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            </div>
            <ul className="space-y-2.5">
              {section.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Contact */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-foreground">تواصل معنا</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
            <Mail size={18} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">البريد الإلكتروني</p>
              <p className="text-xs text-muted-foreground font-english">support@numaxio.com</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
            <HelpCircle size={18} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">مركز المساعدة</p>
              <p className="text-xs text-muted-foreground">متاح على مدار الساعة</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HelpPage;
