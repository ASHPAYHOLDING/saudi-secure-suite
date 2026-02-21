/**
 * IntegrationDocs — Renders provider-specific documentation
 * Fetches from integration_docs table by provider_key.
 * Shows setup guide, FAQ, troubleshooting, and security notes.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen, HelpCircle, AlertTriangle, Shield,
  ChevronDown, ChevronUp, Lightbulb, CheckCircle2,
  FileText, Wrench,
} from "lucide-react";

interface SetupStep {
  title: string;
  body: string;
  fields?: string[];
  tips?: string[];
}

interface FaqItem {
  q: string;
  a: string;
}

interface TroubleshootingItem {
  symptoms: string;
  causes: string;
  fixes: string;
}

interface SecurityNote {
  title: string;
  body: string;
}

interface IntegrationDocsData {
  id: string;
  provider_key: string;
  title: string;
  title_en: string | null;
  short_description: string;
  short_description_en: string | null;
  setup_steps: SetupStep[];
  faq: FaqItem[];
  troubleshooting: TroubleshootingItem[];
  security_notes: SecurityNote[];
  updated_at: string;
}

// ── Accordion Item ──
const AccordionItem = ({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-foreground">{question}</span>
        {open ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Loading Skeleton ──
const DocsSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-full" />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ── Empty State ──
const DocsEmptyState = ({ providerKey, isRTL }: { providerKey: string; isRTL: boolean }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
      <FileText size={28} className="text-muted-foreground/40" />
    </div>
    <div>
      <p className="text-foreground font-medium">
        {isRTL ? "لا يوجد توثيق لهذا المزود بعد" : "No documentation available yet"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {isRTL
          ? `لم يتم إضافة توثيق لـ "${providerKey}" حتى الآن.`
          : `Documentation for "${providerKey}" has not been added yet.`}
      </p>
    </div>
  </div>
);

// ── Main Component ──
const IntegrationDocs = ({ providerKey }: { providerKey: string }) => {
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const { data: docs, isLoading } = useQuery({
    queryKey: ["integration-docs", providerKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_docs")
        .select("*")
        .eq("provider_key", providerKey)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as IntegrationDocsData | null;
    },
    enabled: !!providerKey,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <DocsSkeleton />;
  if (!docs) return <DocsEmptyState providerKey={providerKey} isRTL={isRTL} />;

  const setupSteps = (docs.setup_steps || []) as SetupStep[];
  const faqItems = (docs.faq || []) as FaqItem[];
  const troubleItems = (docs.troubleshooting || []) as TroubleshootingItem[];
  const securityNotes = (docs.security_notes || []) as SecurityNote[];

  const tabs = [
    { id: "setup", label: isRTL ? "دليل الإعداد" : "Setup Guide", icon: BookOpen, count: setupSteps.length },
    { id: "faq", label: isRTL ? "الأسئلة الشائعة" : "FAQ", icon: HelpCircle, count: faqItems.length },
    { id: "troubleshooting", label: isRTL ? "استكشاف الأخطاء" : "Troubleshooting", icon: Wrench, count: troubleItems.length },
    { id: "security", label: isRTL ? "ملاحظات أمنية" : "Security", icon: Shield, count: securityNotes.length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {isRTL ? docs.title : (docs.title_en || docs.title)}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL ? docs.short_description : (docs.short_description_en || docs.short_description)}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="setup">
        <TabsList className="h-auto p-1 flex-wrap gap-0.5 w-full justify-start bg-muted/40 rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-1.5 text-xs px-3 py-2 rounded-lg"
                disabled={tab.count === 0}
              >
                <Icon size={13} />
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 min-w-[18px]">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ── Setup Guide ── */}
        <TabsContent value="setup" className="space-y-4 mt-4">
          {setupSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.body}
                  </p>

                  {step.fields && step.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {step.fields.map((f) => (
                        <Badge key={f} variant="outline" className="text-[10px] font-mono">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {step.tips && step.tips.length > 0 && (
                    <div className="space-y-1.5">
                      {step.tips.map((tip, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs text-accent bg-accent/5 rounded-lg p-2.5">
                          <Lightbulb size={13} className="mt-0.5 shrink-0" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* ── FAQ ── */}
        <TabsContent value="faq" className="space-y-2 mt-4">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} question={item.q} answer={item.a} defaultOpen={i === 0} />
          ))}
        </TabsContent>

        {/* ── Troubleshooting ── */}
        <TabsContent value="troubleshooting" className="space-y-3 mt-4">
          {troubleItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/30">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.symptoms}</p>
                    </div>
                  </div>
                  <div className="ps-6 space-y-1.5 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground/80">{isRTL ? "السبب:" : "Cause:"}</span> {item.causes}</p>
                    <div className="flex items-start gap-1.5 text-accent">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                      <p><span className="font-medium">{isRTL ? "الحل:" : "Fix:"}</span> {item.fixes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* ── Security Notes ── */}
        <TabsContent value="security" className="space-y-3 mt-4">
          {securityNotes.map((note, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/30 bg-accent/[0.02]">
                <CardContent className="p-4 flex items-start gap-3">
                  <Shield size={16} className="text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{note.body}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationDocs;
