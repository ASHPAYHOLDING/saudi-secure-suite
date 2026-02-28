import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PaymentLink {
  id: string;
  tenant_id: string;
  public_token: string;
  signature: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  customer_id: string | null;
  invoice_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  gateway: string;
  payment_url: string | null;
  gateway_reference: string | null;
  expires_at: string | null;
  paid_at: string | null;
  canceled_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentLinkInput {
  amount: number;
  currency?: string;
  description: string;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  invoice_id?: string | null;
  expires_at?: string | null;
}

export function usePaymentLinks() {
  const { tenantId, user } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching payment links:", error);
    } else {
      setLinks((data || []) as unknown as PaymentLink[]);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = async (input: CreatePaymentLinkInput): Promise<PaymentLink | null> => {
    if (!tenantId || !user?.id) return null;
    setCreating(true);
    const { data, error } = await supabase
      .from("payment_links")
      .insert({
        tenant_id: tenantId,
        amount: input.amount,
        currency: input.currency || "SAR",
        description: input.description,
        customer_id: input.customer_id || null,
        customer_name: input.customer_name || null,
        customer_email: input.customer_email || null,
        customer_phone: input.customer_phone || null,
        invoice_id: input.invoice_id || null,
        expires_at: input.expires_at || null,
        created_by: user.id,
        status: "created",
      } as any)
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error("فشل إنشاء رابط الدفع");
      console.error(error);
      return null;
    }
    toast.success("تم إنشاء رابط الدفع بنجاح");
    fetchLinks();
    return data as unknown as PaymentLink;
  };

  const cancelLink = async (id: string) => {
    const { error } = await supabase
      .from("payment_links")
      .update({ status: "canceled", canceled_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("فشل إلغاء الرابط");
    } else {
      toast.success("تم إلغاء رابط الدفع");
      fetchLinks();
    }
  };

  const getShareUrl = (link: PaymentLink) => {
    const base = window.location.origin;
    return `${base}/pay/${link.public_token}`;
  };

  return { links, loading, creating, createLink, cancelLink, fetchLinks, getShareUrl };
}
