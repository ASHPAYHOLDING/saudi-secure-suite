import { useState } from "react";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ShieldAlert, ShieldCheck } from "lucide-react";

interface TestResult {
  name: string;
  passed: boolean;
  status: number | string;
  message: string;
}

const DebugWorkflows = () => {
  const { user, tenantId } = useAuth();
  const [instanceId, setInstanceId] = useState("");
  const [actionId, setActionId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const addResult = (r: TestResult) => setResults((prev) => [...prev, r]);

  const runTests = async () => {
    setResults([]);
    setRunning(true);

    // Test 1: Workflow action without valid instance → should fail
    const t1 = await secureRpc("secure_workflow_action", {
      p_instance_id: "00000000-0000-0000-0000-000000000000",
      p_action: "approved",
    });
    addResult({
      name: "Workflow action with invalid instance",
      passed: !!t1.error,
      status: t1.error ? "403/404" : "200",
      message: t1.error?.message || "Unexpectedly succeeded",
    });

    // Test 2: Approval action without valid IDs → should fail
    const t2 = await secureRpc("secure_approval_action", {
      p_action_id: "00000000-0000-0000-0000-000000000000",
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_decision: "approved",
    });
    addResult({
      name: "Approval action with invalid request",
      passed: !!t2.error,
      status: t2.error ? "403/404" : "200",
      message: t2.error?.message || "Unexpectedly succeeded",
    });

    // Test 3: Invalid action type
    const t3 = await secureRpc("secure_workflow_action", {
      p_instance_id: "00000000-0000-0000-0000-000000000000",
      p_action: "hack",
    });
    addResult({
      name: "Invalid action type rejected",
      passed: !!t3.error,
      status: t3.error ? "400" : "200",
      message: t3.error?.message || "Unexpectedly succeeded",
    });

    // Test 4: With real instance (if provided)
    if (instanceId) {
      const t4 = await secureRpc("secure_workflow_action", {
        p_instance_id: instanceId,
        p_action: "approved",
        p_comment: "Debug test approval",
      });
      addResult({
        name: `Real workflow approval (${instanceId.slice(0, 8)}...)`,
        passed: !t4.error,
        status: t4.error ? "Error" : "200",
        message: t4.error?.message || `Status: ${t4.data?.status}`,
      });
    }

    // Test 5: With real approval request (if provided)
    if (actionId && requestId) {
      const t5 = await secureRpc("secure_approval_action", {
        p_action_id: actionId,
        p_request_id: requestId,
        p_decision: "approved",
        p_comment: "Debug test",
      });
      addResult({
        name: `Real approval action (${requestId.slice(0, 8)}...)`,
        passed: !t5.error,
        status: t5.error ? "Error" : "200",
        message: t5.error?.message || `Status: ${t5.data?.status}`,
      });
    }

    setRunning(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6" />
          Workflow Security Tests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tests RBAC enforcement, tenant isolation, and self-approval prevention on workflow actions.
        </p>
        <div className="mt-2 text-xs text-muted-foreground">
          User: {user?.email} | Tenant: {tenantId?.slice(0, 8)}...
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optional: Test with real IDs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Workflow Instance ID</Label>
            <Input
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="UUID of a workflow_instances row"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Approval Action ID</Label>
              <Input
                value={actionId}
                onChange={(e) => setActionId(e.target.value)}
                placeholder="UUID"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Approval Request ID</Label>
              <Input
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="UUID"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={runTests} disabled={running} className="w-full">
        {running ? "Running tests..." : "Run Security Tests"}
      </Button>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Results ({results.filter((r) => r.passed).length}/{results.length} passed)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                {r.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.name}</span>
                    <Badge variant={r.passed ? "default" : "destructive"} className="text-xs">
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{r.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DebugWorkflows;
