import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "م. عبدالله الشهراني",
    role: "مدير مالي",
    content: "نيوماكسيو وفّر علينا ساعات من العمل اليدوي. الفواتير الإلكترونية المتوافقة مع ZATCA كانت السبب الرئيسي لاختيارنا المنصة.",
    rating: 5,
  },
  {
    name: "أ. نورة القحطاني",
    role: "محاسبة أولى",
    content: "أفضل نظام محاسبي استخدمته. سهل الاستخدام، يدعم العربية بالكامل، والتقارير المالية دقيقة ومفصلة.",
    rating: 5,
  },
  {
    name: "أ. فهد الدوسري",
    role: "صاحب مؤسسة",
    content: "من أول يوم قدرت أصدر فواتير احترافية بالختم الإلكتروني. الدعم الفني ممتاز ويرد بسرعة.",
    rating: 5,
  },
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-16 sm:py-20 md:py-24 bg-background" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-14 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2">
            <Star size={14} className="text-accent fill-accent" />
            <span className="text-sm font-semibold text-accent">آراء عملائنا</span>
          </div>
          <h2 className="mb-5 text-3xl font-bold text-foreground md:text-5xl text-center">
            ماذا يقول عملاؤنا
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl border border-border bg-card p-8 shadow-card transition-shadow duration-200 hover:shadow-elevated"
            >
              <Quote size={32} className="text-accent/20 mb-4" />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              <p className="text-sm leading-relaxed text-foreground mb-6">
                "{t.content}"
              </p>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-accent text-accent-foreground text-sm font-bold">
                    {t.name.split(" ").pop()?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
