import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, Sparkles, Trash2, AlertTriangle,
  TrendingUp, ShieldAlert, DollarSign, Users, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "تحليل الإيرادات", prompt: "حلّل إيرادات المنصة الحالية واقترح طرقاً لزيادتها" },
  { icon: AlertTriangle, label: "كشف الشذوذ", prompt: "هل توجد أنماط غير طبيعية في بيانات المنصة تستدعي الانتباه؟" },
  { icon: DollarSign, label: "مراجعة التسعير", prompt: "راجع خطط التسعير الحالية واقترح تعديلات بناءً على بيانات الاستخدام" },
  { icon: Users, label: "توقع التسرب", prompt: "حدّد المنشآت المعرضة لإلغاء الاشتراك واقترح إجراءات وقائية" },
  { icon: ShieldAlert, label: "حالة الأمان", prompt: "قدّم ملخصاً عن الحالة الأمنية للمنصة والتهديدات المحتملة" },
  { icon: Sparkles, label: "ملخص شامل", prompt: "قدّم ملخصاً شاملاً عن حالة المنصة مع أهم التوصيات" },
];

const AdminAIAssistant = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (allMessages: Msg[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "خطأ", description: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      return;
    }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-ai-chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      }
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "خطأ غير متوقع" }));
      throw new Error(err.error || `Error ${resp.status}`);
    }

    if (!resp.body) throw new Error("No stream body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    let done = false;
    while (!done) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { done = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsert(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsert(content);
        } catch { /* ignore */ }
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(updated);
    } catch (e: any) {
      console.error(e);
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="text-accent" size={28} />
            المستشار الذكي
          </h1>
          <p className="text-sm text-muted-foreground">
            مساعد ذكاء اصطناعي استشاري — يحلّل البيانات المجمّعة فقط ولا يتخذ إجراءات
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles size={12} /> وضع استشاري
          </Badge>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessages([])}
              className="gap-1"
            >
              <Trash2 size={14} /> مسح المحادثة
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <Card className="border-accent/20">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 py-10">
                <div className="rounded-full bg-accent/10 p-6">
                  <Bot size={48} className="text-accent" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    مرحباً بك في المستشار الذكي
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    يمكنني مساعدتك في تحليل مؤشرات المنصة، كشف الأنماط غير الطبيعية،
                    واقتراح تحسينات — استناداً إلى البيانات المجمّعة فقط.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-2xl">
                  {QUICK_PROMPTS.map((qp) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={qp.label}
                        onClick={() => sendMessage(qp.prompt)}
                        className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-right hover:border-accent/50 hover:bg-accent/5 transition-colors"
                      >
                        <Icon size={16} className="text-accent shrink-0" />
                        <span>{qp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-end">
                    <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      جاري التحليل...
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اسأل عن مؤشرات المنصة، الإيرادات، الأمان، أو التسعير..."
                className="min-h-[44px] max-h-[120px] resize-none"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="shrink-0 h-11 w-11"
              >
                <Send size={18} />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              المستشار الذكي يعمل على البيانات المجمّعة فقط ولا يصل إلى بيانات المنشآت الخاصة
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAIAssistant;
