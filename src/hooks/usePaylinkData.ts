import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PaylinkTransaction {
  id: string;
  transaction_number: string;
  transaction_type: string;
  description: string | null;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  fee_type: string | null;
  fee_rate: number | null;
  payment_method: string | null;
  status: string;
  invoice_id: string | null;
  created_at: string;
}

export interface PaylinkFeeConfig {
  id: string;
  tenant_id: string;
  fee_type: string;
  fee_percentage: number;
  fee_fixed_amount: number;
  min_fee: number;
  max_fee: number | null;
  is_active: boolean;
}

export interface PaylinkStats {
  totalSales: number;
  pendingAmount: number;
  totalFees: number;
  netAmount: number;
  availableBalance: number;
  feeRate: number;
}

export function usePaylinkData(tenantId: string | undefined) {
  const [transactions, setTransactions] = useState<PaylinkTransaction[]>([]);
  const [feeConfig, setFeeConfig] = useState<PaylinkFeeConfig | null>(null);
  const [stats, setStats] = useState<PaylinkStats>({
    totalSales: 0, pendingAmount: 0, totalFees: 0,
    netAmount: 0, availableBalance: 0, feeRate: 2.9,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [txRes, configRes] = await Promise.all([
      supabase
        .from("paylink_transactions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("paylink_fee_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const txs = (txRes.data || []) as PaylinkTransaction[];
    setTransactions(txs);

    if (configRes.data) {
      setFeeConfig(configRes.data as PaylinkFeeConfig);
    }

    // Calculate stats
    const deposits = txs.filter((t) => t.transaction_type === "deposit");
    const withdrawals = txs.filter((t) => t.transaction_type === "withdrawal");
    const completedDeposits = deposits.filter((t) => t.status === "completed");
    const completedWithdrawals = withdrawals.filter((t) => t.status === "completed");
    const pendingDeposits = deposits.filter((t) => t.status === "pending");

    const totalSales = completedDeposits.reduce((s, t) => s + t.gross_amount, 0);
    const pendingAmount = pendingDeposits.reduce((s, t) => s + t.gross_amount, 0);
    const totalFees = completedDeposits.reduce((s, t) => s + t.fee_amount, 0);
    const netAmount = completedDeposits.reduce((s, t) => s + t.net_amount, 0);
    const totalWithdrawn = completedWithdrawals.reduce((s, t) => s + t.gross_amount, 0);
    const availableBalance = netAmount - totalWithdrawn;

    setStats({
      totalSales,
      pendingAmount,
      totalFees,
      netAmount,
      availableBalance,
      feeRate: configRes.data?.fee_percentage ?? 2.9,
    });

    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateFee = (grossAmount: number) => {
    const cfg = feeConfig;
    let fee = 0;
    if (!cfg) {
      fee = Math.round(grossAmount * 0.029 * 100) / 100;
    } else if (cfg.fee_type === "percentage") {
      fee = Math.round(grossAmount * (cfg.fee_percentage / 100) * 100) / 100;
    } else if (cfg.fee_type === "fixed") {
      fee = cfg.fee_fixed_amount;
    } else if (cfg.fee_type === "combined") {
      fee = Math.round(grossAmount * (cfg.fee_percentage / 100) * 100) / 100 + cfg.fee_fixed_amount;
    }
    if (cfg && fee < cfg.min_fee) fee = cfg.min_fee;
    if (cfg?.max_fee && fee > cfg.max_fee) fee = cfg.max_fee;
    return { fee, net: grossAmount - fee };
  };

  return { transactions, feeConfig, stats, loading, refetch: fetchData, calculateFee };
}
