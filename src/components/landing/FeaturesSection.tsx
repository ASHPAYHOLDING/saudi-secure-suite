import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  FileText, Calculator, Shield, BarChart3, Stamp, Users,
  FileSignature, ShieldCheck, Globe, Zap, Lock, Cloud,
  Receipt, ShoppingCart, Truck, CreditCard, Wallet,
  Bot, Eye, GitBranch, Bell, MessageSquare, Layers,
  FileSpreadsheet, PieChart, Scale, Package, ClipboardList,
  Workflow, UserCog, Building2, Sparkles, ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface FeatureCategory {
  id: string;
  label: string;
  icon: any;
  color: string;
  features: { icon: any; title: string; description: string }[];
}

const categories: FeatureCategory[] = [
  {
    id: "invoicing",
    label: "الفوترة الإلكترونية",
    icon: FileText,
    color: "from-emerald-500 to-teal-500",
    features: [
      { icon: FileText, title: "فواتير ZATCA المرحلة الثانية", description: "إصدار فواتير ضريبية متوافقة مع هيئة الزكاة والدخل مع QR Code بتشفير TLV وتكامل مباشر." },
      { icon: Calculator, title: "حساب ضريبة تلقائي 15%", description: "حساب ضريبة القيمة المضافة تلقائياً على كل بند مع تفصيل كامل للمبالغ والخصومات." },
      { icon: Receipt, title: "إشعارات دائنة", description: "إصدار إشعارات دائنة مرتبطة بالفواتير مع تتبع كامل للمبالغ المستردة." },
      { icon: Eye, title: "معالجة OCR ذكية", description: "مسح الفواتير الورقية تلقائياً باستخدام الذكاء الاصطناعي واستخراج البيانات." },
      { icon: Bell, title: "تذكيرات الدفع", description: "إرسال تذكيرات دفع تلقائية للعملاء عبر البريد والرسائل." },
      { icon: Stamp, title: "ختم إلكتروني رسمي", description: "ختم رقمي معتمد يُضاف تلقائياً على الفواتير والمستندات مع بيانات المنشأة." },
    ],
  },
  {
    id: "sales",
    label: "المبيعات والمشتريات",
    icon: ShoppingCart,
    color: "from-blue-500 to-indigo-500",
    features: [
      { icon: ClipboardList, title: "عروض الأسعار", description: "إنشاء عروض أسعار احترافية وتحويلها لفواتير بنقرة واحدة." },
      { icon: ShoppingCart, title: "أوامر البيع", description: "إدارة كاملة لأوامر البيع من الإنشاء حتى التسليم والفوترة." },
      { icon: Package, title: "أوامر الشراء", description: "تتبع أوامر الشراء من الموردين مع ربط تلقائي بالمخزون." },
      { icon: Truck, title: "إذون التسليم", description: "إصدار وتتبع إذون تسليم البضائع المرتبطة بالأوامر." },
      { icon: FileSignature, title: "إدارة العقود", description: "إنشاء وتتبع العقود مع قوالب جاهزة وتوقيع إلكتروني وإصدار نسخ." },
      { icon: Users, title: "إدارة العملاء CRM", description: "قاعدة بيانات شاملة مع السجل التجاري والرقم الضريبي وسجل المعاملات." },
    ],
  },
  {
    id: "finance",
    label: "المالية والمحاسبة",
    icon: PieChart,
    color: "from-violet-500 to-purple-500",
    features: [
      { icon: CreditCard, title: "إدارة المصروفات", description: "تتبع وتصنيف المصروفات مع رفع الإيصالات وسير اعتماد المصروفات." },
      { icon: Wallet, title: "محفظة رقمية Numaxio Pay", description: "محفظة رقمية متكاملة مع شحن رصيد وتحليلات مالية وتشفير 256-bit." },
      { icon: Scale, title: "قيود يومية محاسبية", description: "إنشاء قيود محاسبية مزدوجة (مدين/دائن) مع ترحيل وتتبع كامل." },
      { icon: BarChart3, title: "تقارير مالية متقدمة", description: "لوحة تحكم تفاعلية بالإيرادات والمصروفات والضرائب وأداء المنشأة." },
      { icon: FileSpreadsheet, title: "الإقرار الضريبي VAT", description: "إنشاء الإقرار الضريبي تلقائياً وتصديره بصيغة جاهزة لهيئة الزكاة." },
      { icon: PieChart, title: "تحليلات متقدمة", description: "رسوم بيانية تفاعلية مع KPIs ومؤشرات أداء مالي في الوقت الفعلي." },
    ],
  },
  {
    id: "operations",
    label: "العمليات والإدارة",
    icon: Building2,
    color: "from-amber-500 to-orange-500",
    features: [
      { icon: Package, title: "إدارة المخزون", description: "تتبع المنتجات والمخزون مع تنبيهات نفاد الكمية وحركة المواد." },
      { icon: Workflow, title: "سير عمل الاعتمادات", description: "تصميم سير عمل اعتماد مخصص للفواتير والمصروفات متعدد المراحل." },
      { icon: GitBranch, title: "إدارة الفروع", description: "إدارة فروع متعددة مع صلاحيات وبيانات مستقلة لكل فرع." },
      { icon: UserCog, title: "فريق العمل والصلاحيات", description: "إدارة أدوار مخصصة وصلاحيات دقيقة لكل عضو في الفريق." },
      { icon: MessageSquare, title: "تعاون وتعليقات", description: "محادثات فريق مباشرة وتعليقات على المستندات مع إشعارات فورية." },
      { icon: Bot, title: "مساعد ذكاء اصطناعي", description: "استعلام بلغة طبيعية عن البيانات المالية وتحليلات ذكية فورية." },
    ],
  },
  {
    id: "security",
    label: "الأمان والامتثال",
    icon: Shield,
    color: "from-rose-500 to-pink-500",
    features: [
      { icon: ShieldCheck, title: "امتثال ZATCA كامل", description: "توافق تام مع المرحلة الأولى والثانية من الفوترة الإلكترونية السعودية." },
      { icon: Lock, title: "تشفير وأمان مؤسسي", description: "تشفير 256-bit كامل للبيانات مع عزل تام بين المنشآت." },
      { icon: Eye, title: "سجل مراجعة شامل", description: "تتبع كل عملية في النظام مع معرفة من قام بها ومتى والتغييرات." },
      { icon: Cloud, title: "سحابي مع نسخ احتياطي", description: "يعمل من أي مكان عبر المتصفح مع نسخ احتياطية يومية تلقائية." },
      { icon: Globe, title: "ثنائي اللغة عربي/إنجليزي", description: "واجهة كاملة بالعربية والإنجليزية مع دعم RTL احترافي." },
      { icon: Layers, title: "تعدد العملات", description: "دعم فوترة بعملات متعددة مع إدارة أسعار الصرف وتقارير موحدة بالريال." },
    ],
  },
];

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [activeCategory, setActiveCategory] = useState("invoicing");

  const activeCat = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <section id="features" className="py-24 md:py-32 bg-background" dir="rtl">
      <div className="container mx-auto px-4" ref={ref}>
        {/* Header */}
        <div className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Sparkles size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">+30 ميزة متكاملة</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl text-center"
          >
            منصة محاسبية شاملة
            <br />
            <span className="text-gradient">صُممت للمنشآت السعودية</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground"
          >
            من الفواتير الإلكترونية إلى المحفظة الرقمية — كل ما تحتاجه لإدارة أعمالك في مكان واحد
          </motion.p>
        </div>

        {/* Category tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-14"
        >
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeCategory === cat.id
                  ? "bg-accent text-accent-foreground shadow-accent-glow"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-accent/30"
              }`}
            >
              <cat.icon size={16} />
              {cat.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Features grid with AnimatePresence-like transitions */}
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {activeCat.features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group relative rounded-2xl border border-border bg-card p-7 shadow-card transition-all duration-300 hover:shadow-elevated hover:border-accent/20 overflow-hidden"
            >
              {/* Hover gradient */}
              <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${activeCat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-3xl`} />
              
              <div className="relative text-center flex flex-col items-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-accent-glow group-hover:scale-110">
                  <feature.icon size={22} />
                </div>
                <h3 className="mb-2 text-base font-bold text-foreground">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Feature count badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-14 text-center"
        >
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-6">
                جرّب جميع المميزات مجاناً
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
