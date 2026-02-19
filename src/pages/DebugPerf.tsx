import { useState, useEffect } from "react";
import { getCallLog, getCallCount, type CallRecord } from "@/lib/timed-call";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DebugPerf = () => {
  const [records, setRecords] = useState<readonly CallRecord[]>([]);
  const [count, setCount] = useState(0);

  const refresh = () => {
    setRecords([...getCallLog()]);
    setCount(getCallCount());
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div dir="rtl" className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">🔧 لوحة الأداء</h1>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">إجمالي الاستدعاءات: {count}</Badge>
          <Button size="sm" variant="outline" onClick={refresh}>تحديث</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">آخر {records.length} استدعاء</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد استدعاءات بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start py-2 pe-4">الاسم</th>
                    <th className="text-start py-2 pe-4">المدة (ms)</th>
                    <th className="text-start py-2 pe-4">الحالة</th>
                    <th className="text-start py-2">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 pe-4 font-mono text-xs">{r.name}</td>
                      <td className={`py-2 pe-4 font-mono text-xs ${r.duration > 3000 ? "text-destructive font-bold" : ""}`}>
                        {r.duration}
                      </td>
                      <td className="py-2 pe-4">
                        <Badge
                          variant={r.status === "ok" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {r.status === "ok" ? "✓" : r.status === "timeout" ? "⏱ timeout" : "✗ error"}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleTimeString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPerf;
