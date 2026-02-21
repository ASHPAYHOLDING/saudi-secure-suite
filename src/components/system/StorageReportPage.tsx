/**
 * StorageReportPage — /dashboard/system/storage
 * Shows table sizes, partition counts, index sizes via get_storage_report() RPC.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Database, HardDrive, Layers, BarChart3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

interface TableInfo {
  table_name: string;
  total_size: string;
  total_bytes: number;
  table_size: string;
  index_size: string;
  is_partitioned: boolean;
}

interface PartitionInfo {
  parent_table: string;
  partition_name: string;
  size: string;
  size_bytes: number;
}

interface PartitionSummary {
  table_name: string;
  partition_count: number;
  total_size: string;
  total_bytes: number;
}

interface StorageReport {
  tables: TableInfo[];
  partitions: PartitionInfo[];
  partition_summary: PartitionSummary[];
  generated_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const StorageReportPage = () => {
  const { isRTL } = useLanguage();

  const { data: report, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["storage-report"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_storage_report" as any);
      if (error) throw error;
      return data as unknown as StorageReport;
    },
  });

  const tables = report?.tables || [];
  const partitions = report?.partitions || [];
  const partitionSummary = report?.partition_summary || [];
  const totalDbSize = tables.reduce((sum, t) => sum + (t.total_bytes || 0), 0);
  const partitionedCount = tables.filter(t => t.is_partitioned).length;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <HardDrive className="w-6 h-6 text-primary" />
          </div>
          <div className={isRTL ? "text-right" : ""}>
            <h1 className="text-2xl font-bold">{isRTL ? "تقرير التخزين" : "Storage Report"}</h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "أحجام الجداول والأقسام والفهارس" : "Table sizes, partitions & index sizes"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`w-4 h-4 me-2 ${isRefetching ? "animate-spin" : ""}`} />
          {isRTL ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="pt-5 text-center">
                  <div className="text-3xl font-bold text-primary">{tables.length}</div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الجداول" : "Total Tables"}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card>
                <CardContent className="pt-5 text-center">
                  <div className="text-3xl font-bold text-green-500">{partitionedCount}</div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "جداول مقسمة" : "Partitioned Tables"}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardContent className="pt-5 text-center">
                  <div className="text-3xl font-bold text-blue-500">{partitions.length}</div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الأقسام" : "Total Partitions"}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardContent className="pt-5 text-center">
                  <div className="text-3xl font-bold text-muted-foreground">{formatBytes(totalDbSize)}</div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "الحجم الإجمالي" : "Total Size"}</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <Tabs defaultValue="tables" dir={isRTL ? "rtl" : "ltr"}>
            <TabsList>
              <TabsTrigger value="tables">
                <Database className="w-4 h-4 me-1" />
                {isRTL ? "الجداول" : "Tables"}
              </TabsTrigger>
              <TabsTrigger value="partitions">
                <Layers className="w-4 h-4 me-1" />
                {isRTL ? "الأقسام" : "Partitions"}
              </TabsTrigger>
            </TabsList>

            {/* Tables Tab */}
            <TabsContent value="tables" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-start p-3 font-medium">{isRTL ? "الجدول" : "Table"}</th>
                          <th className="text-start p-3 font-medium">{isRTL ? "الحجم الكلي" : "Total Size"}</th>
                          <th className="text-start p-3 font-medium">{isRTL ? "حجم البيانات" : "Data Size"}</th>
                          <th className="text-start p-3 font-medium">{isRTL ? "حجم الفهارس" : "Index Size"}</th>
                          <th className="text-start p-3 font-medium">{isRTL ? "النوع" : "Type"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map((t, i) => (
                          <motion.tr
                            key={t.table_name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="p-3 font-mono text-xs">{t.table_name}</td>
                            <td className="p-3 font-semibold">{t.total_size}</td>
                            <td className="p-3 text-muted-foreground">{t.table_size}</td>
                            <td className="p-3 text-muted-foreground">{t.index_size}</td>
                            <td className="p-3">
                              {t.is_partitioned ? (
                                <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                                  <Layers className="w-3 h-3 me-1" />
                                  {isRTL ? "مقسم" : "Partitioned"}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  {isRTL ? "عادي" : "Regular"}
                                </Badge>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Partitions Tab */}
            <TabsContent value="partitions" className="mt-4 space-y-4">
              {/* Summary */}
              {partitionSummary.map((ps) => (
                <Card key={ps.table_name}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      {ps.table_name}
                      <Badge variant="secondary" className="text-xs">
                        {ps.partition_count} {isRTL ? "قسم" : "partitions"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {ps.total_size}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-start p-3 font-medium text-xs">{isRTL ? "القسم" : "Partition"}</th>
                            <th className="text-start p-3 font-medium text-xs">{isRTL ? "الحجم" : "Size"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partitions
                            .filter((p) => p.parent_table === ps.table_name)
                            .map((p) => (
                              <tr key={p.partition_name} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="p-3 font-mono text-xs">{p.partition_name}</td>
                                <td className="p-3 text-muted-foreground">{p.size}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {partitionSummary.length === 0 && (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    {isRTL ? "لا توجد أقسام" : "No partitions found"}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {report?.generated_at && (
            <p className="text-xs text-muted-foreground text-center">
              {isRTL ? "تم التوليد في:" : "Generated at:"}{" "}
              {new Date(report.generated_at).toLocaleString(isRTL ? "ar-SA" : "en-US")}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default StorageReportPage;
