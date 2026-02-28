import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSetupChecklist } from "@/hooks/useSetupChecklist";
import { Rocket, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SetupChecklist() {
  const navigate = useNavigate();
  const { items, doneCount, total, visible, snooze, snoozing } = useSetupChecklist();

  if (!visible) return null;

  const progress = (doneCount / total) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="px-6 pt-4"
      >
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">أكمل إعداد حسابك</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doneCount} من {total} مهام مكتملة
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => snooze()}
                disabled={snoozing}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                {snoozing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                إخفاء مؤقتاً
              </Button>
            </div>
            <Progress value={progress} className="h-1.5 mt-3" />
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    onClick={() => !item.done && navigate(item.href)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-start transition-colors ${
                      item.done
                        ? "opacity-60"
                        : "hover:bg-muted/50 cursor-pointer"
                    }`}
                    disabled={item.done}
                  >
                    <Checkbox checked={item.done} className="pointer-events-none" />
                    <span
                      className={`text-sm flex-1 ${
                        item.done ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.optional && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        اختياري
                      </Badge>
                    )}
                    {!item.done && (
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
