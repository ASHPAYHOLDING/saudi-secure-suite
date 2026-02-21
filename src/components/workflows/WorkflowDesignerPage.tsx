import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import type { WorkflowNode, WorkflowEdge, WorkflowDefinition, WorkflowNodeType } from "./designer-types";
import { NODE_META } from "./designer-types";
import {
  Save, Upload, Plus, CheckCircle2, GitBranch, Zap, Bell,
  Loader2, ArrowRight, Undo2, History,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = { CheckCircle2, GitBranch, Zap, Bell };

export const WorkflowDesignerPage = () => {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get("id");

  const [workflowName, setWorkflowName] = useState("مسار عمل جديد");
  const [documentType, setDocumentType] = useState("expense");
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; version: number; is_published: boolean; created_at: string }>>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing workflow
  useEffect(() => {
    if (workflowId && tenantId) loadWorkflow();
  }, [workflowId, tenantId]);

  const loadWorkflow = async () => {
    setLoading(true);
    try {
      const { data: wf } = await supabase
        .from("approval_workflows")
        .select("*")
        .eq("id", workflowId!)
        .single();

      if (wf) {
        setWorkflowName(wf.name);
        setDocumentType(wf.document_type);
        const def = (wf.definition_json as unknown as WorkflowDefinition) || { nodes: [], edges: [] };
        setNodes(def.nodes || []);
        setEdges(def.edges || []);
      }

      const { data: vers } = await supabase
        .from("workflow_versions")
        .select("id, version, is_published, created_at")
        .eq("workflow_id", workflowId!)
        .order("version", { ascending: false });

      if (vers) setVersions(vers);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addNode = (type: WorkflowNodeType) => {
    const id = crypto.randomUUID();
    const x = 200 + Math.random() * 200;
    const y = 100 + nodes.length * 100;
    setNodes((prev) => [...prev, { id, type, label: NODE_META[type].label, x, y, config: {} }]);
    setSelectedNodeId(id);
    setHasChanges(true);
  };

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    setHasChanges(true);
  }, []);

  const addEdge = (from: string, to: string) => {
    if (edges.some((e) => e.from === from && e.to === to)) return;
    setEdges((prev) => [...prev, { id: crypto.randomUUID(), from, to }]);
    setHasChanges(true);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    setHasChanges(true);
  };

  const deleteEdge = (id: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setHasChanges(true);
  };

  const updateNode = (updated: WorkflowNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setHasChanges(true);
  };

  const getDefinition = (): WorkflowDefinition => ({ nodes, edges });

  const saveDraft = async () => {
    if (!tenantId || !user) return;
    setSaving(true);
    try {
      const def = getDefinition();
      if (workflowId) {
        await supabase
          .from("approval_workflows")
          .update({ name: workflowName, definition_json: def as any, updated_at: new Date().toISOString() })
          .eq("id", workflowId);
      } else {
        const { data, error } = await supabase
          .from("approval_workflows")
          .insert({
            name: workflowName,
            document_type: documentType,
            condition_type: "always",
            tenant_id: tenantId,
            created_by: user.id,
            definition_json: def as any,
          })
          .select()
          .single();
        if (error) throw error;
        // Navigate to URL with new id
        navigate(`/dashboard/workflows/designer?id=${data.id}`, { replace: true });
      }
      setHasChanges(false);
      toast({ title: "تم الحفظ", description: "تم حفظ المسودة بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const publishVersion = async () => {
    if (!workflowId || !tenantId || !user) {
      toast({ title: "حفظ أولاً", description: "يرجى حفظ المسودة قبل النشر", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      // Unpublish existing versions
      await supabase
        .from("workflow_versions")
        .update({ is_published: false })
        .eq("workflow_id", workflowId)
        .eq("tenant_id", tenantId);

      const nextVersion = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;

      const { error } = await supabase.from("workflow_versions").insert({
        workflow_id: workflowId,
        tenant_id: tenantId,
        version: nextVersion,
        definition_json: getDefinition() as any,
        is_published: true,
        published_at: new Date().toISOString(),
        published_by: user.id,
        created_by: user.id,
      });
      if (error) throw error;

      // Mark workflow as active
      await supabase
        .from("approval_workflows")
        .update({ is_active: true })
        .eq("id", workflowId);

      toast({ title: "تم النشر", description: `تم نشر الإصدار ${nextVersion} بنجاح` });
      await loadWorkflow();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const loadVersion = async (versionId: string) => {
    try {
      const { data } = await supabase
        .from("workflow_versions")
        .select("definition_json")
        .eq("id", versionId)
        .single();
      if (data) {
        const def = data.definition_json as unknown as WorkflowDefinition;
        setNodes(def.nodes || []);
        setEdges(def.edges || []);
        setHasChanges(true);
        toast({ title: "تم التحميل", description: "تم تحميل الإصدار السابق" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/approvals")} className="gap-1">
            <ArrowRight size={14} />
            العودة
          </Button>
          <Input
            value={workflowName}
            onChange={(e) => { setWorkflowName(e.target.value); setHasChanges(true); }}
            className="h-8 w-56 text-sm font-semibold border-none bg-transparent focus-visible:ring-1"
          />
          {hasChanges && <Badge variant="secondary" className="text-[10px]">غير محفوظ</Badge>}
        </div>

        <div className="flex items-center gap-2">
          {/* Add node buttons */}
          {(Object.entries(NODE_META) as [WorkflowNodeType, typeof NODE_META[WorkflowNodeType]][]).map(([type, meta]) => {
            const Icon = ICON_MAP[meta.icon];
            return (
              <Button key={type} variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => addNode(type)}>
                <Icon size={14} style={{ color: meta.color }} />
                {meta.label}
              </Button>
            );
          })}

          <div className="w-px h-6 bg-border mx-1" />

          <Button variant="outline" size="sm" className="gap-1 h-8" onClick={saveDraft} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ
          </Button>

          <Button size="sm" className="gap-1 h-8" onClick={publishVersion} disabled={publishing || !workflowId}>
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            نشر
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onMoveNode={moveNode}
            onAddEdge={addEdge}
            onDeleteNode={deleteNode}
            onDeleteEdge={deleteEdge}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 border-r border-border bg-card shrink-0 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <NodePropertiesPanel
              node={selectedNode}
              onUpdate={updateNode}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>

          {/* Versions */}
          {versions.length > 0 && (
            <div className="border-t border-border p-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <History size={12} />
                الإصدارات
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => loadVersion(v.id)}
                    className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    <span>v{v.version}</span>
                    <div className="flex items-center gap-1.5">
                      {v.is_published && <Badge className="text-[9px] h-4 px-1.5">فعّال</Badge>}
                      <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString("ar-SA")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDesignerPage;
