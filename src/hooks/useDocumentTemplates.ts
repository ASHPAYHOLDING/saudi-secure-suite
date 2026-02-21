import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DocumentTemplateType } from "@/lib/document-template-variables";

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  document_type: DocumentTemplateType;
  name: string;
  name_en: string | null;
  html_template: string;
  css: string;
  variables: any[];
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useDocumentTemplates(documentType?: DocumentTemplateType) {
  return useQuery({
    queryKey: ["document-templates", documentType],
    queryFn: async () => {
      let query = supabase
        .from("document_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (documentType) {
        query = query.eq("document_type", documentType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DocumentTemplate[];
    },
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<DocumentTemplate> & { id?: string }) => {
      if (template.id) {
        const { data, error } = await supabase
          .from("document_templates" as any)
          .update({
            name: template.name,
            name_en: template.name_en,
            html_template: template.html_template,
            css: template.css,
            variables: template.variables,
            is_default: template.is_default,
          } as any)
          .eq("id", template.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as DocumentTemplate;
      } else {
        const { data, error } = await supabase
          .from("document_templates" as any)
          .insert({
            tenant_id: template.tenant_id,
            document_type: template.document_type,
            name: template.name,
            name_en: template.name_en,
            html_template: template.html_template,
            css: template.css,
            variables: template.variables || [],
            is_default: template.is_default || false,
            created_by: template.created_by,
          } as any)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as DocumentTemplate;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("تم حفظ القالب بنجاح");
    },
    onError: (error: Error) => {
      toast.error(`خطأ في حفظ القالب: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_templates" as any)
        .update({ is_active: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("تم حذف القالب");
    },
  });
}
