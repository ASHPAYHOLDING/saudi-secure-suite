export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_locks: {
        Row: {
          id: string
          is_active: boolean
          locked_at: string
          locked_by: string
          reason: string
          unlocked_at: string | null
          unlocked_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by: string
          reason?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by?: string
          reason?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          commission_amount: number
          commission_rate: number
          commission_type: string
          created_at: string
          gross_amount: number
          id: string
          invoice_id: string | null
          locked_until: string | null
          net_amount: number
          original_commission_id: string | null
          paid_at: string | null
          payout_id: string | null
          recurring_month: number | null
          status: string
          subscription_id: string | null
          subscription_period_end: string | null
          subscription_period_start: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          commission_amount?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          locked_until?: string | null
          net_amount?: number
          original_commission_id?: string | null
          paid_at?: string | null
          payout_id?: string | null
          recurring_month?: number | null
          status?: string
          subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_period_start?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          locked_until?: string | null
          net_amount?: number
          original_commission_id?: string | null
          paid_at?: string | null
          payout_id?: string | null
          recurring_month?: number | null
          status?: string
          subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_period_start?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "affiliate_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_original_commission_id_fkey"
            columns: ["original_commission_id"]
            isOneToOne: false
            referencedRelation: "affiliate_commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversion_events: {
        Row: {
          affiliate_id: string
          created_at: string
          event_metadata: Json | null
          event_type: string
          id: string
          ip_address: string | null
          referral_id: string | null
          referred_user_id: string | null
          revenue_amount: number | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          event_metadata?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          referral_id?: string | null
          referred_user_id?: string | null
          revenue_amount?: number | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          event_metadata?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          referral_id?: string | null
          referred_user_id?: string | null
          revenue_amount?: number | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversion_events_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversion_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversion_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_fraud_attempts: {
        Row: {
          affiliate_id: string | null
          created_at: string
          details: Json | null
          fraud_type: string
          id: string
          ip_address: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          affiliate_id?: string | null
          created_at?: string
          details?: Json | null
          fraud_type: string
          id?: string
          ip_address?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          affiliate_id?: string | null
          created_at?: string
          details?: Json | null
          fraud_type?: string
          id?: string
          ip_address?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_fraud_attempts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_schedules: {
        Row: {
          affiliate_id: string
          auto_approve: boolean | null
          created_at: string
          id: string
          is_active: boolean | null
          last_payout_at: string | null
          min_payout_amount: number | null
          next_payout_at: string | null
          payout_day: number | null
          schedule_type: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          auto_approve?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_payout_at?: string | null
          min_payout_amount?: number | null
          next_payout_at?: string | null
          payout_day?: number | null
          schedule_type?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          auto_approve?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_payout_at?: string | null
          min_payout_amount?: number | null
          next_payout_at?: string | null
          payout_day?: number | null
          schedule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_schedules_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          referred_tenant_id: string | null
          referred_user_id: string | null
          source: string | null
          subscription_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          referred_tenant_id?: string | null
          referred_user_id?: string | null
          source?: string | null
          subscription_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          referred_tenant_id?: string | null
          referred_user_id?: string | null
          source?: string | null
          subscription_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_tenant_id_fkey"
            columns: ["referred_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          bank_account_name: string | null
          bank_iban: string | null
          bank_name: string | null
          code: string
          commission_rate: number
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          status: string
          tenant_id: string | null
          tier: string
          total_earnings: number
          total_paid: number
          total_pending: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          code: string
          commission_rate?: number
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string | null
          tier?: string
          total_earnings?: number
          total_paid?: number
          total_pending?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          code?: string
          commission_rate?: number
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string | null
          tier?: string
          total_earnings?: number
          total_paid?: number
          total_pending?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_definitions: {
        Row: {
          category: string
          created_at: string
          depends_on_tables: string[]
          formula_description: string | null
          id: string
          is_active: boolean
          metric_key: string
          name_ar: string
          name_en: string | null
          sql_source: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          depends_on_tables?: string[]
          formula_description?: string | null
          id?: string
          is_active?: boolean
          metric_key: string
          name_ar: string
          name_en?: string | null
          sql_source: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          depends_on_tables?: string[]
          formula_description?: string | null
          id?: string
          is_active?: boolean
          metric_key?: string
          name_ar?: string
          name_en?: string | null
          sql_source?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_per_minute: number
          scopes: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          scopes?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          scopes?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          method: string
          path: string
          response_time_ms: number | null
          status_code: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          method: string
          path: string
          response_time_ms?: number | null
          status_code: number
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          response_time_ms?: number | null
          status_code?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_request_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          action: string
          comment: string | null
          created_at: string
          id: string
          request_id: string
          step_id: string
          step_order: number
          tenant_id: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          action?: string
          comment?: string | null
          created_at?: string
          id?: string
          request_id: string
          step_id: string
          step_order: number
          tenant_id: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          action?: string
          comment?: string | null
          created_at?: string
          id?: string
          request_id?: string
          step_id?: string
          step_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "approval_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          document_amount: number | null
          document_id: string
          document_number: string | null
          document_type: string
          id: string
          requested_by: string
          status: string
          tenant_id: string
          total_steps: number
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_amount?: number | null
          document_id: string
          document_number?: string | null
          document_type: string
          id?: string
          requested_by: string
          status?: string
          tenant_id: string
          total_steps?: number
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_amount?: number | null
          document_id?: string
          document_number?: string | null
          document_type?: string
          id?: string
          requested_by?: string
          status?: string
          tenant_id?: string
          total_steps?: number
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflow_steps: {
        Row: {
          approver_role: string | null
          approver_type: string
          approver_user_id: string | null
          created_at: string
          id: string
          is_required: boolean
          step_name: string
          step_name_en: string | null
          step_order: number
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          approver_role?: string | null
          approver_type?: string
          approver_user_id?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          step_name?: string
          step_name_en?: string | null
          step_order?: number
          tenant_id: string
          workflow_id: string
        }
        Update: {
          approver_role?: string | null
          approver_type?: string
          approver_user_id?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          step_name?: string
          step_name_en?: string | null
          step_order?: number
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflow_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          condition_type: string
          created_at: string
          created_by: string
          definition_json: Json | null
          document_type: string
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          name: string
          name_en: string | null
          priority: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          condition_type?: string
          created_at?: string
          created_by: string
          definition_json?: Json | null
          document_type: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name: string
          name_en?: string | null
          priority?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          created_by?: string
          definition_json?: Json | null
          document_type?: string
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name?: string
          name_en?: string | null
          priority?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_value: Json | null
          before_value: Json | null
          changes: Json | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          ip_address: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          action: string
          after_value?: Json | null
          before_value?: Json | null
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          action?: string
          after_value?: Json | null
          before_value?: Json | null
          changes?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_members: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          branch_id: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          branch_color: string | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_main: boolean
          manager_id: string | null
          name: string
          name_en: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_color?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          manager_id?: string | null
          name: string
          name_en?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_color?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          manager_id?: string | null
          name?: string
          name_en?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_actuals_cache: {
        Row: {
          actual_amount: number
          budget_id: string
          id: string
          line_id: string
          period: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          budget_id: string
          id?: string
          line_id: string
          period: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          budget_id?: string
          id?: string
          line_id?: string
          period?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_actuals_cache_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_actuals_cache_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_actuals_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alert_events: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          line_id: string | null
          message_ar: string | null
          percent_used: number | null
          period: string | null
          status: Database["public"]["Enums"]["budget_alert_event_status"]
          tenant_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          line_id?: string | null
          message_ar?: string | null
          percent_used?: number | null
          period?: string | null
          status?: Database["public"]["Enums"]["budget_alert_event_status"]
          tenant_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          line_id?: string | null
          message_ar?: string | null
          percent_used?: number | null
          period?: string | null
          status?: Database["public"]["Enums"]["budget_alert_event_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_alert_events_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alert_events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "budget_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alert_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alert_rules: {
        Row: {
          budget_id: string
          created_at: string
          enabled: boolean
          id: string
          notify_channels: Json
          scope: Database["public"]["Enums"]["budget_alert_scope"]
          tenant_id: string
          threshold_percent: number
        }
        Insert: {
          budget_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          notify_channels?: Json
          scope?: Database["public"]["Enums"]["budget_alert_scope"]
          tenant_id: string
          threshold_percent?: number
        }
        Update: {
          budget_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          notify_channels?: Json
          scope?: Database["public"]["Enums"]["budget_alert_scope"]
          tenant_id?: string
          threshold_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_alert_rules_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alert_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_lines: {
        Row: {
          account_id: string | null
          budget_id: string
          cost_center_id: string | null
          created_at: string
          department_id: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          line_type: Database["public"]["Enums"]["budget_line_type"]
          months: Json | null
          notes: string | null
          period_type: Database["public"]["Enums"]["budget_period_type"]
          planned_amount: number | null
          project_id: string | null
          tenant_id: string
        }
        Insert: {
          account_id?: string | null
          budget_id: string
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          line_type?: Database["public"]["Enums"]["budget_line_type"]
          months?: Json | null
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period_type"]
          planned_amount?: number | null
          project_id?: string | null
          tenant_id: string
        }
        Update: {
          account_id?: string | null
          budget_id?: string
          cost_center_id?: string | null
          created_at?: string
          department_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          line_type?: Database["public"]["Enums"]["budget_line_type"]
          months?: Json | null
          notes?: string | null
          period_type?: Database["public"]["Enums"]["budget_period_type"]
          planned_amount?: number | null
          project_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          fiscal_year: number
          id: string
          name_ar: string
          name_en: string | null
          status: Database["public"]["Enums"]["budget_status"]
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fiscal_year: number
          id?: string
          name_ar: string
          name_en?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          fiscal_year?: number
          id?: string
          name_ar?: string
          name_en?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          name_ar: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          name_ar?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          name_ar?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          mentions: string[] | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          mentions?: string[] | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          mentions?: string[] | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          created_at: string
          device_info: Json | null
          error_message: string
          id: string
          route: string | null
          stack: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          error_message: string
          id?: string
          route?: string | null
          stack?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          error_message?: string
          id?: string
          route?: string | null
          stack?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_errors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_notifications: {
        Row: {
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          tenant_id: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          tenant_id: string
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          tenant_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_test_logs: {
        Row: {
          category: string
          created_at: string
          details: Json | null
          id: string
          provider: string
          status: string
          tenant_id: string
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json | null
          id?: string
          provider: string
          status: string
          tenant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          provider?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          body_html: string
          contract_type: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          placeholders: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          contract_type?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          placeholders?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          placeholders?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_versions: {
        Row: {
          body_html: string
          change_summary: string | null
          changed_by: string
          contract_id: string
          created_at: string
          id: string
          tenant_id: string
          version_number: number
        }
        Insert: {
          body_html: string
          change_summary?: string | null
          changed_by: string
          contract_id: string
          created_at?: string
          id?: string
          tenant_id: string
          version_number?: number
        }
        Update: {
          body_html?: string
          change_summary?: string | null
          changed_by?: string
          contract_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          base_amount: number
          body_html: string
          branch_id: string | null
          contract_number: string
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          currency_code: string
          customer_id: string | null
          end_date: string | null
          exchange_rate_at_creation: number
          id: string
          notes: string | null
          signed_at: string | null
          signed_by: string | null
          start_date: string
          status: string
          template_id: string | null
          tenant_id: string
          title: string
          total_value: number
          updated_at: string
        }
        Insert: {
          base_amount?: number
          body_html?: string
          branch_id?: string | null
          contract_number: string
          contract_type?: string
          created_at?: string
          created_by: string
          currency?: string
          currency_code?: string
          customer_id?: string | null
          end_date?: string | null
          exchange_rate_at_creation?: number
          id?: string
          notes?: string | null
          signed_at?: string | null
          signed_by?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          tenant_id: string
          title: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          base_amount?: number
          body_html?: string
          branch_id?: string | null
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          currency_code?: string
          customer_id?: string | null
          end_date?: string | null
          exchange_rate_at_creation?: number
          id?: string
          notes?: string | null
          signed_at?: string | null
          signed_by?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          tenant_id?: string
          title?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          discount: number
          id: string
          line_total: number
          quantity: number
          sort_order: number
          tenant_id: string
          unit: string | null
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          discount?: number
          id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          discount?: number
          id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          credit_date: string
          credit_note_number: string
          currency: string
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          grand_total: number
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string
          status: string
          subtotal: number
          tenant_id: string
          updated_at: string
          vat_total: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          credit_date?: string
          credit_note_number: string
          currency?: string
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          grand_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string
          status?: string
          subtotal?: number
          tenant_id: string
          updated_at?: string
          vat_total?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          credit_date?: string
          credit_note_number?: string
          currency?: string
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          grand_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string
          status?: string
          subtotal?: number
          tenant_id?: string
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number
          is_active: boolean
          is_base: boolean
          name_ar: string
          name_en: string | null
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          is_base?: boolean
          name_ar: string
          name_en?: string | null
          symbol: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number
          is_active?: boolean
          is_base?: boolean
          name_ar?: string
          name_en?: string | null
          symbol?: string
        }
        Relationships: []
      }
      currency_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          source: string
          tenant_id: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          tenant_id: string
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          tenant_id?: string
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_report_configs: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          group_by: string[]
          id: string
          is_shared: boolean | null
          name: string
          period_from: string | null
          period_to: string | null
          selected_columns: string[]
          sort_by: string | null
          sort_direction: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          view_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string[]
          id?: string
          is_shared?: boolean | null
          name: string
          period_from?: string | null
          period_to?: string | null
          selected_columns?: string[]
          sort_by?: string | null
          sort_direction?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
          view_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          group_by?: string[]
          id?: string
          is_shared?: boolean | null
          name?: string
          period_from?: string | null
          period_to?: string | null
          selected_columns?: string[]
          sort_by?: string | null
          sort_direction?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          view_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_report_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"] | null
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          name_ar: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"] | null
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          name_ar: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"] | null
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          name_ar?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          id: string
          tenant_id: string
          title: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          id?: string
          tenant_id: string
          title?: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          branch_id: string | null
          cr_number: string | null
          created_at: string
          credit_limit: number | null
          customer_type: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          notes: string | null
          phone: string | null
          segment: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_id?: string | null
          cr_number?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_id?: string | null
          cr_number?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_type?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          expires_at: string | null
          export_type: string
          file_size_bytes: number | null
          file_url: string | null
          filters: Json | null
          format: string
          id: string
          requested_by: string
          row_count: number | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          requested_by: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          export_type?: string
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          requested_by?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          created_at: string
          delivery_note_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          tenant_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          delivery_note_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          delivery_note_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          delivery_date: string
          id: string
          note_number: string
          note_type: string
          notes: string | null
          source_id: string | null
          source_type: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          delivery_date?: string
          id?: string
          note_number: string
          note_type?: string
          notes?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivery_date?: string
          id?: string
          note_number?: string
          note_type?: string
          notes?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          manager_id: string | null
          name: string
          name_en: string | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          name?: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_tokens: {
        Row: {
          access_count: number | null
          accessed_at: string | null
          created_at: string
          created_by: string | null
          document_id: string
          document_type: string
          expires_at: string
          id: string
          max_access: number | null
          tenant_id: string
          token: string
        }
        Insert: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type: string
          expires_at?: string
          id?: string
          max_access?: number | null
          tenant_id: string
          token?: string
        }
        Update: {
          access_count?: number | null
          accessed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type?: string
          expires_at?: string
          id?: string
          max_access?: number | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_lifecycle: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string
          document_id: string
          document_type: string
          from_status: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string
          document_id: string
          document_type: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          to_status: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          document_id?: string
          document_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_request_logs: {
        Row: {
          action: string | null
          correlation_id: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          ip_address: string | null
          metadata: Json | null
          method: string
          status_code: number
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          correlation_id: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string
          status_code?: number
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          correlation_id?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          method?: string
          status_code?: number
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          entity_id: string | null
          entity_type: string | null
          failure_reason: string | null
          id: string
          last_retry_at: string | null
          max_retries: number
          metadata: Json | null
          provider_id: string | null
          provider_response: Json | null
          recipient_email: string
          resend_of: string | null
          resend_reason: string | null
          retry_count: number
          sender_address: string
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_type: string
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          metadata?: Json | null
          provider_id?: string | null
          provider_response?: Json | null
          recipient_email: string
          resend_of?: string | null
          resend_reason?: string | null
          retry_count?: number
          sender_address?: string
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          metadata?: Json | null
          provider_id?: string | null
          provider_response?: Json | null
          recipient_email?: string
          resend_of?: string | null
          resend_reason?: string | null
          retry_count?: number
          sender_address?: string
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_resend_of_fkey"
            columns: ["resend_of"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_definitions: {
        Row: {
          allow_tenant_override: boolean
          body_html: string
          body_text: string
          category: string
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          email_type: string
          id: string
          is_active: boolean
          is_system: boolean
          name_ar: string
          name_en: string
          sender_key: string
          subject_template: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          allow_tenant_override?: boolean
          body_html?: string
          body_text?: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          email_type: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar: string
          name_en?: string
          sender_key?: string
          subject_template?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          allow_tenant_override?: boolean
          body_html?: string
          body_text?: string
          category?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          email_type?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name_ar?: string
          name_en?: string
          sender_key?: string
          subject_template?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      email_template_versions: {
        Row: {
          body_html: string
          body_text: string
          change_summary: string | null
          changed_by: string | null
          created_at: string
          id: string
          subject_template: string
          template_id: string
          version_number: number
        }
        Insert: {
          body_html?: string
          body_text?: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          subject_template?: string
          template_id: string
          version_number?: number
        }
        Update: {
          body_html?: string
          body_text?: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          subject_template?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_template_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements_rebuild_queue: {
        Row: {
          created_at: string
          id: number
          processed_at: string | null
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          processed_at?: string | null
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: number
          processed_at?: string | null
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_rebuild_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_comments: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_edited: boolean
          mentions: string[] | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_edited?: boolean
          mentions?: string[] | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_edited?: boolean
          mentions?: string[] | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entity_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          base_currency_total: number
          branch_id: string | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string
          currency_code: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          exchange_rate: number
          exchange_rate_at_creation: number
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          payment_method: string
          profit_center_id: string | null
          receipt_filename: string | null
          receipt_url: string | null
          rejection_reason: string | null
          status: string
          tenant_id: string
          title: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          base_currency_total?: number
          branch_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          currency_code?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exchange_rate?: number
          exchange_rate_at_creation?: number
          expense_date?: string
          expense_number: string
          id?: string
          notes?: string | null
          payment_method?: string
          profit_center_id?: string | null
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id: string
          title?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          base_currency_total?: number
          branch_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          currency_code?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          exchange_rate?: number
          exchange_rate_at_creation?: number
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          payment_method?: string
          profit_center_id?: string | null
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string
          title?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "expenses_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          category: string
          created_at: string
          description: string | null
          enabled_plans: string[]
          id: string
          is_enabled_globally: boolean
          key: string
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          enabled_plans?: string[]
          id?: string
          is_enabled_globally?: boolean
          key: string
          name_ar: string
          name_en?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          enabled_plans?: string[]
          id?: string
          is_enabled_globally?: boolean
          key?: string
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string
          created_by: string
          event_type: string
          hash_current: string
          hash_prev: string
          id: string
          payload_json: Json
          tenant_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          created_at?: string
          created_by: string
          event_type: string
          hash_current?: string
          hash_prev?: string
          id?: string
          payload_json?: Json
          tenant_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string
          created_by?: string
          event_type?: string
          hash_current?: string
          hash_prev?: string
          id?: string
          payload_json?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          description: string | null
          id: string
          line_total: number
          product_id: string
          quantity: number
          receipt_id: string
          sort_order: number
          tenant_id: string
          unit_cost: number
          variant_id: string | null
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          description?: string | null
          id?: string
          line_total?: number
          product_id: string
          quantity?: number
          receipt_id: string
          sort_order?: number
          tenant_id: string
          unit_cost?: number
          variant_id?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          description?: string | null
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          receipt_id?: string
          sort_order?: number
          tenant_id?: string
          unit_cost?: number
          variant_id?: string | null
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          branch_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          grand_total: number
          id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_date: string
          receipt_number: string
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string
          updated_at: string
          vat_total: number
          warehouse_id: string
        }
        Insert: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          grand_total?: number
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          receipt_number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
          vat_total?: number
          warehouse_id: string
        }
        Update: {
          branch_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          grand_total?: number
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_date?: string
          receipt_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
          vat_total?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admins: {
        Row: {
          can_access_subsidiaries: boolean | null
          can_manage_subsidiaries: boolean | null
          can_manage_users: boolean | null
          can_view_consolidated: boolean | null
          created_at: string
          id: string
          parent_tenant_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access_subsidiaries?: boolean | null
          can_manage_subsidiaries?: boolean | null
          can_manage_users?: boolean | null
          can_view_consolidated?: boolean | null
          created_at?: string
          id?: string
          parent_tenant_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access_subsidiaries?: boolean | null
          can_manage_subsidiaries?: boolean | null
          can_manage_users?: boolean | null
          can_view_consolidated?: boolean | null
          created_at?: string
          id?: string
          parent_tenant_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_admins_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          checked_at: string
          error_message: string | null
          id: string
          response_time_ms: number | null
          service_id: string
          status: string
          status_code: number | null
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id: string
          status?: string
          status_code?: number | null
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          service_id?: string
          status?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_checks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          message: string
          message_ar: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          message: string
          message_ar?: string | null
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          message?: string
          message_ar?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "platform_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_support_tickets: {
        Row: {
          category: string
          created_at: string
          diagnostics: Json | null
          id: string
          issue_type: string
          message: string
          provider: string
          status: string
          tenant_id: string
        }
        Insert: {
          category: string
          created_at?: string
          diagnostics?: Json | null
          id?: string
          issue_type: string
          message: string
          provider: string
          status?: string
          tenant_id: string
        }
        Update: {
          category?: string
          created_at?: string
          diagnostics?: Json | null
          id?: string
          issue_type?: string
          message?: string
          provider?: string
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      integration_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          integration_id: string
          records_failed: number
          records_synced: number
          started_at: string
          status: string
          sync_type: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id: string
          records_failed?: number
          records_synced?: number
          started_at?: string
          status?: string
          sync_type: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id?: string
          records_failed?: number
          records_synced?: number
          started_at?: string
          status?: string
          sync_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "tenant_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intercompany_links: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          is_active: boolean | null
          link_type: string
          linked_tenant_id: string
          parent_tenant_id: string
          supplier_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string
          linked_tenant_id: string
          parent_tenant_id: string
          supplier_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          link_type?: string
          linked_tenant_id?: string
          parent_tenant_id?: string
          supplier_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercompany_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_links_linked_tenant_id_fkey"
            columns: ["linked_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_links_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          id: string
          last_movement_at: string | null
          product_id: string
          quantity_available: number | null
          quantity_on_hand: number
          quantity_reserved: number
          tenant_id: string
          total_value: number | null
          updated_at: string
          variant_id: string | null
          warehouse_id: string
          weighted_avg_cost: number
        }
        Insert: {
          id?: string
          last_movement_at?: string | null
          product_id: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          tenant_id: string
          total_value?: number | null
          updated_at?: string
          variant_id?: string | null
          warehouse_id: string
          weighted_avg_cost?: number
        }
        Update: {
          id?: string
          last_movement_at?: string | null
          product_id?: string
          quantity_available?: number | null
          quantity_on_hand?: number
          quantity_reserved?: number
          tenant_id?: string
          total_value?: number | null
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string
          weighted_avg_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          journal_entry_id: string | null
          movement_type: string
          new_avg_cost: number | null
          new_qty: number | null
          notes: string | null
          previous_avg_cost: number | null
          previous_qty: number | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          total_cost: number | null
          transfer_id: string | null
          unit_cost: number | null
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          journal_entry_id?: string | null
          movement_type: string
          new_avg_cost?: number | null
          new_qty?: number | null
          notes?: string | null
          previous_avg_cost?: number | null
          previous_qty?: number | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          total_cost?: number | null
          transfer_id?: string | null
          unit_cost?: number | null
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          journal_entry_id?: string | null
          movement_type?: string
          new_avg_cost?: number | null
          new_qty?: number | null
          notes?: string | null
          previous_avg_cost?: number | null
          previous_qty?: number | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          total_cost?: number | null
          transfer_id?: string | null
          unit_cost?: number | null
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_delivery_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          invoice_id: string
          message_body: string | null
          metadata: Json | null
          recipient: string
          sent_at: string
          sent_by: string
          status: string
          tenant_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          invoice_id: string
          message_body?: string | null
          metadata?: Json | null
          recipient?: string
          sent_at?: string
          sent_by: string
          status?: string
          tenant_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          invoice_id?: string
          message_body?: string | null
          metadata?: Json | null
          recipient?: string
          sent_at?: string
          sent_by?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_delivery_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_delivery_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delivery_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          tenant_id: string
          unit: string | null
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_message_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          channel?: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          columns_config: Json
          created_at: string
          created_by: string
          font_family: string
          footer_text: string | null
          header_text_color: string
          id: string
          is_default: boolean
          layout_style: string
          name: string
          primary_color: string
          secondary_color: string
          show_logo: boolean
          show_notes: boolean
          show_qr_code: boolean
          show_stamp: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          columns_config?: Json
          created_at?: string
          created_by: string
          font_family?: string
          footer_text?: string | null
          header_text_color?: string
          id?: string
          is_default?: boolean
          layout_style?: string
          name?: string
          primary_color?: string
          secondary_color?: string
          show_logo?: boolean
          show_notes?: boolean
          show_qr_code?: boolean
          show_stamp?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          columns_config?: Json
          created_at?: string
          created_by?: string
          font_family?: string
          footer_text?: string | null
          header_text_color?: string
          id?: string
          is_default?: boolean
          layout_style?: string
          name?: string
          primary_color?: string
          secondary_color?: string
          show_logo?: boolean
          show_notes?: boolean
          show_qr_code?: boolean
          show_stamp?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          base_amount: number
          base_currency_total: number
          branch_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string
          currency_code: string
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          discount_total: number
          due_date: string
          exchange_rate: number
          exchange_rate_at_creation: number
          grand_total: number
          id: string
          invoice_date: string
          invoice_hash: string | null
          invoice_number: string
          invoice_type: string
          invoice_uuid: string | null
          notes: string | null
          previous_invoice_hash: string | null
          profit_center_id: string | null
          status: string
          subtotal: number
          supply_date: string
          tenant_id: string
          updated_at: string
          vat_total: number
          zatca_clearance_status: string | null
          zatca_errors: Json | null
          zatca_reporting_status: string | null
          zatca_response: Json | null
          zatca_signed_xml: string | null
          zatca_status: string | null
          zatca_submitted_at: string | null
          zatca_warnings: Json | null
          zatca_xml: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          base_amount?: number
          base_currency_total?: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          currency_code?: string
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          discount_total?: number
          due_date?: string
          exchange_rate?: number
          exchange_rate_at_creation?: number
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_hash?: string | null
          invoice_number: string
          invoice_type?: string
          invoice_uuid?: string | null
          notes?: string | null
          previous_invoice_hash?: string | null
          profit_center_id?: string | null
          status?: string
          subtotal?: number
          supply_date?: string
          tenant_id: string
          updated_at?: string
          vat_total?: number
          zatca_clearance_status?: string | null
          zatca_errors?: Json | null
          zatca_reporting_status?: string | null
          zatca_response?: Json | null
          zatca_signed_xml?: string | null
          zatca_status?: string | null
          zatca_submitted_at?: string | null
          zatca_warnings?: Json | null
          zatca_xml?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          base_amount?: number
          base_currency_total?: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          currency_code?: string
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          discount_total?: number
          due_date?: string
          exchange_rate?: number
          exchange_rate_at_creation?: number
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_hash?: string | null
          invoice_number?: string
          invoice_type?: string
          invoice_uuid?: string | null
          notes?: string | null
          previous_invoice_hash?: string | null
          profit_center_id?: string | null
          status?: string
          subtotal?: number
          supply_date?: string
          tenant_id?: string
          updated_at?: string
          vat_total?: number
          zatca_clearance_status?: string | null
          zatca_errors?: Json | null
          zatca_reporting_status?: string | null
          zatca_response?: Json | null
          zatca_signed_xml?: string | null
          zatca_status?: string | null
          zatca_submitted_at?: string | null
          zatca_warnings?: Json | null
          zatca_xml?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          base_total_credit: number
          base_total_debit: number
          branch_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          exchange_rate: number
          id: string
          posted_at: string | null
          posted_by: string | null
          profit_center_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          tenant_id: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          base_total_credit?: number
          base_total_debit?: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number: string
          exchange_rate?: number
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          profit_center_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tenant_id: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          base_total_credit?: number
          base_total_debit?: number
          branch_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          exchange_rate?: number
          id?: string
          posted_at?: string | null
          posted_by?: string | null
          profit_center_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          tenant_id?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_profit_center_id_fkey"
            columns: ["profit_center_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_name: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          exchange_rate: number
          id: string
          journal_entry_id: string
          original_credit: number
          original_debit: number
          sort_order: number
          tenant_id: string
        }
        Insert: {
          account_name: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id: string
          original_credit?: number
          original_debit?: number
          sort_order?: number
          tenant_id: string
        }
        Update: {
          account_name?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          exchange_rate?: number
          id?: string
          journal_entry_id?: string
          original_credit?: number
          original_debit?: number
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      maintenance_windows: {
        Row: {
          affected_services: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          description_ar: string | null
          ends_at: string
          id: string
          starts_at: string
          status: string
          title: string
          title_ar: string
        }
        Insert: {
          affected_services?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          title: string
          title_ar: string
        }
        Update: {
          affected_services?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          title?: string
          title_ar?: string
        }
        Relationships: []
      }
      marketing_events_logs: {
        Row: {
          action: string | null
          created_at: string
          duration_ms: number | null
          environment: string | null
          event_name: string
          id: string
          idempotency_key: string | null
          provider: string
          request_body: Json | null
          response_body: string | null
          status_code: number | null
          tenant_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          environment?: string | null
          event_name: string
          id?: string
          idempotency_key?: string | null
          provider?: string
          request_body?: Json | null
          response_body?: string | null
          status_code?: number | null
          tenant_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          duration_ms?: number | null
          environment?: string | null
          event_name?: string
          id?: string
          idempotency_key?: string | null
          provider?: string
          request_body?: Json | null
          response_body?: string | null
          status_code?: number | null
          tenant_id?: string
        }
        Relationships: []
      }
      marketing_idempotency: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          provider: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          provider: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          provider?: string
          tenant_id?: string
        }
        Relationships: []
      }
      marketing_integrations: {
        Row: {
          config: Json
          created_at: string
          environment: string
          id: string
          provider: string
          secrets_encrypted: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          provider: string
          secrets_encrypted?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          environment?: string
          id?: string
          provider?: string
          secrets_encrypted?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitoring_alert_rules: {
        Row: {
          condition: string
          created_at: string
          id: string
          is_active: boolean
          metric_name: string
          metric_source: string
          name: string
          severity: string
          threshold: number
          updated_at: string
          window_minutes: number
        }
        Insert: {
          condition?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metric_name: string
          metric_source: string
          name: string
          severity?: string
          threshold: number
          updated_at?: string
          window_minutes?: number
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metric_name?: string
          metric_source?: string
          name?: string
          severity?: string
          threshold?: number
          updated_at?: string
          window_minutes?: number
        }
        Relationships: []
      }
      monitoring_alerts: {
        Row: {
          current_value: number
          fired_at: string
          id: string
          is_resolved: boolean
          message: string
          metric_name: string
          metric_source: string
          resolved_at: string | null
          rule_id: string | null
          severity: string
          threshold: number
        }
        Insert: {
          current_value: number
          fired_at?: string
          id?: string
          is_resolved?: boolean
          message: string
          metric_name: string
          metric_source: string
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string
          threshold: number
        }
        Update: {
          current_value?: number
          fired_at?: string
          id?: string
          is_resolved?: boolean
          message?: string
          metric_name?: string
          metric_source?: string
          resolved_at?: string | null
          rule_id?: string | null
          severity?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "monitoring_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          days_before: number
          id: string
          is_enabled: boolean
          notification_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_before?: number
          id?: string
          is_enabled?: boolean
          notification_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_before?: number
          id?: string
          is_enabled?: boolean
          notification_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          extracted_data: Json | null
          file_name: string
          file_size_bytes: number
          id: string
          model_used: string
          processing_time_ms: number | null
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_size_bytes?: number
          id?: string
          model_used?: string
          processing_time_ms?: number | null
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_size_bytes?: number
          id?: string
          model_used?: string
          processing_time_ms?: number | null
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_gateway_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          gateway_key: string
          gateway_response: Json | null
          id: string
          integration_id: string
          invoice_id: string
          paid_at: string | null
          payment_url: string | null
          session_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          gateway_key: string
          gateway_response?: Json | null
          id?: string
          integration_id: string
          invoice_id: string
          paid_at?: string | null
          payment_url?: string | null
          session_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          gateway_key?: string
          gateway_response?: Json | null
          id?: string
          integration_id?: string
          invoice_id?: string
          paid_at?: string | null
          payment_url?: string | null
          session_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_gateway_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "paid_gateway_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_gateway_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_fee_configs: {
        Row: {
          created_at: string
          fee_fixed_amount: number
          fee_percentage: number
          fee_type: string
          id: string
          is_active: boolean
          max_fee: number | null
          min_fee: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          fee_fixed_amount?: number
          fee_percentage?: number
          fee_type?: string
          id?: string
          is_active?: boolean
          max_fee?: number | null
          min_fee?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          fee_fixed_amount?: number
          fee_percentage?: number
          fee_type?: string
          id?: string
          is_active?: boolean
          max_fee?: number | null
          min_fee?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paylink_fee_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_fee_logs: {
        Row: {
          created_at: string
          description: string | null
          fee_amount: number
          fee_fixed: number | null
          fee_percentage: number | null
          fee_type: string
          gross_amount: number
          id: string
          net_amount: number
          tenant_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fee_amount: number
          fee_fixed?: number | null
          fee_percentage?: number | null
          fee_type: string
          gross_amount: number
          id?: string
          net_amount: number
          tenant_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fee_amount?: number
          fee_fixed?: number | null
          fee_percentage?: number | null
          fee_type?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          tenant_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paylink_fee_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paylink_fee_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "paylink_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_kyc_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          kyc_request_id: string
          tenant_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          kyc_request_id: string
          tenant_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          kyc_request_id?: string
          tenant_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "paylink_kyc_documents_kyc_request_id_fkey"
            columns: ["kyc_request_id"]
            isOneToOne: false
            referencedRelation: "paylink_kyc_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paylink_kyc_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_kyc_requests: {
        Row: {
          admin_full_name: string | null
          admin_notes: string | null
          admin_signature_data: string | null
          admin_signed_at: string | null
          admin_signed_ip: string | null
          admin_user_id: string | null
          agreement_html: string
          agreement_version: string
          applicant_type: string
          bank_name: string | null
          business_name: string
          business_name_en: string | null
          contract_number: string
          cr_number: string | null
          created_at: string
          email: string
          iban: string
          id: string
          national_id: string | null
          phone: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subscriber_full_name: string
          subscriber_signature_data: string | null
          subscriber_signed_at: string | null
          subscriber_signed_ip: string | null
          subscriber_user_id: string
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          admin_full_name?: string | null
          admin_notes?: string | null
          admin_signature_data?: string | null
          admin_signed_at?: string | null
          admin_signed_ip?: string | null
          admin_user_id?: string | null
          agreement_html: string
          agreement_version?: string
          applicant_type?: string
          bank_name?: string | null
          business_name: string
          business_name_en?: string | null
          contract_number: string
          cr_number?: string | null
          created_at?: string
          email: string
          iban: string
          id?: string
          national_id?: string | null
          phone: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subscriber_full_name: string
          subscriber_signature_data?: string | null
          subscriber_signed_at?: string | null
          subscriber_signed_ip?: string | null
          subscriber_user_id: string
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          admin_full_name?: string | null
          admin_notes?: string | null
          admin_signature_data?: string | null
          admin_signed_at?: string | null
          admin_signed_ip?: string | null
          admin_user_id?: string | null
          agreement_html?: string
          agreement_version?: string
          applicant_type?: string
          bank_name?: string | null
          business_name?: string
          business_name_en?: string | null
          contract_number?: string
          cr_number?: string | null
          created_at?: string
          email?: string
          iban?: string
          id?: string
          national_id?: string | null
          phone?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subscriber_full_name?: string
          subscriber_signature_data?: string | null
          subscriber_signed_at?: string | null
          subscriber_signed_ip?: string | null
          subscriber_user_id?: string
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paylink_kyc_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_payout_settings: {
        Row: {
          account_holder_name: string
          bank_name: string
          created_at: string
          iban: string
          id: string
          is_active: boolean
          min_payout_amount: number
          payout_day: number | null
          payout_schedule: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_holder_name?: string
          bank_name?: string
          created_at?: string
          iban?: string
          id?: string
          is_active?: boolean
          min_payout_amount?: number
          payout_day?: number | null
          payout_schedule?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_holder_name?: string
          bank_name?: string
          created_at?: string
          iban?: string
          id?: string
          is_active?: boolean
          min_payout_amount?: number
          payout_day?: number | null
          payout_schedule?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paylink_payout_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_payouts: {
        Row: {
          account_holder_name: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          failure_reason: string | null
          fee_amount: number
          gross_amount: number
          iban: string | null
          id: string
          net_amount: number
          payout_number: string
          processed_at: string | null
          scheduled_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          fee_amount?: number
          gross_amount?: number
          iban?: string | null
          id?: string
          net_amount?: number
          payout_number: string
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          failure_reason?: string | null
          fee_amount?: number
          gross_amount?: number
          iban?: string | null
          id?: string
          net_amount?: number
          payout_number?: string
          processed_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paylink_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      paylink_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fee_amount: number
          fee_rate: number | null
          fee_type: string | null
          gateway_reference: string | null
          gross_amount: number
          id: string
          invoice_id: string | null
          net_amount: number
          paylink_transaction_no: string | null
          payment_method: string | null
          status: string
          tenant_id: string
          transaction_number: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_amount?: number
          fee_rate?: number | null
          fee_type?: string | null
          gateway_reference?: string | null
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          net_amount?: number
          paylink_transaction_no?: string | null
          payment_method?: string | null
          status?: string
          tenant_id: string
          transaction_number: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_amount?: number
          fee_rate?: number | null
          fee_type?: string | null
          gateway_reference?: string | null
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          net_amount?: number
          paylink_transaction_no?: string | null
          payment_method?: string | null
          status?: string
          tenant_id?: string
          transaction_number?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paylink_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "paylink_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paylink_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          metadata: Json | null
          provider: string
          provider_session_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          provider: string
          provider_session_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          provider?: string
          provider_session_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          expires_at: string | null
          gateway: string
          gateway_reference: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          paid_at: string | null
          payment_url: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          currency?: string
          expires_at?: string | null
          gateway?: string
          gateway_reference?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          paid_at?: string | null
          payment_url?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          expires_at?: string | null
          gateway?: string
          gateway_reference?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payment_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminder_logs: {
        Row: {
          body: string
          channel: string
          created_at: string
          customer_id: string
          error_message: string | null
          id: string
          invoice_id: string
          recipient: string
          schedule_id: string | null
          sent_at: string
          status: string
          subject: string
          tenant_id: string
        }
        Insert: {
          body?: string
          channel?: string
          created_at?: string
          customer_id: string
          error_message?: string | null
          id?: string
          invoice_id: string
          recipient?: string
          schedule_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          tenant_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          customer_id?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          recipient?: string
          schedule_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_reminder_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminder_schedules: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          created_by: string
          days_offset: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          name_en: string | null
          subject_template: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          channel?: string
          created_at?: string
          created_by: string
          days_offset?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name_en?: string | null
          subject_template?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          created_by?: string
          days_offset?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name_en?: string | null
          subject_template?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      period_locks: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          lock_reason: string | null
          locked_at: string
          locked_by: string
          period_month: number
          period_year: number
          tenant_id: string
          unlock_reason: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by: string
          period_month: number
          period_year: number
          tenant_id: string
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          lock_reason?: string | null
          locked_at?: string
          locked_by?: string
          period_month?: number
          period_year?: number
          tenant_id?: string
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_locks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          key: string
          name_ar: string
          name_en: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          key: string
          name_ar: string
          name_en?: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
        }
        Relationships: []
      }
      permission_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          name_ar: string
          permissions: string[]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          name_ar: string
          permissions?: string[]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          name_ar?: string
          permissions?: string[]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          limit_value: number | null
          plan_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          plan_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          limit_value?: number | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_incidents: {
        Row: {
          affected_services: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          description_ar: string | null
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          affected_services?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          affected_services?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_ar?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      platform_services: {
        Row: {
          category: string
          check_url: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          name_ar: string
        }
        Insert: {
          category?: string
          check_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          name_ar: string
        }
        Update: {
          category?: string
          check_url?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          name_ar?: string
        }
        Relationships: []
      }
      platform_templates: {
        Row: {
          allow_tenant_customization: boolean
          body_html: string
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default: boolean
          is_locked: boolean
          name_ar: string
          name_en: string
          placeholders: Json
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_tenant_customization?: boolean
          body_html?: string
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          name_ar: string
          name_en?: string
          placeholders?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_tenant_customization?: boolean
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_locked?: boolean
          name_ar?: string
          name_en?: string
          placeholders?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_batches: {
        Row: {
          batch_number: string
          cost_price: number | null
          created_at: string
          created_by: string
          expiry_date: string | null
          id: string
          initial_quantity: number
          notes: string | null
          product_id: string
          production_date: string | null
          quantity: number
          status: string
          supplier_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          batch_number: string
          cost_price?: number | null
          created_at?: string
          created_by: string
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          notes?: string | null
          product_id: string
          production_date?: string | null
          quantity?: number
          status?: string
          supplier_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          batch_number?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          notes?: string | null
          product_id?: string
          production_date?: string | null
          quantity?: number
          status?: string
          supplier_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          barcode: string | null
          cost_price: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          product_id: string
          sku: string | null
          tenant_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          product_id: string
          sku?: string | null
          tenant_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          product_id?: string
          sku?: string | null
          tenant_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_metrics: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          metric_source: string
          metric_value: number
          recorded_at: string
          tags: Json | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          metric_source: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          metric_source?: string
          metric_value?: number
          recorded_at?: string
          tags?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          branch_id: string | null
          category: string | null
          cost_price: number | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_threshold: number | null
          name: string
          name_en: string | null
          product_type: string
          sku: string | null
          stock_quantity: number
          tenant_id: string
          track_stock: boolean
          unit: string | null
          unit_price: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          barcode?: string | null
          branch_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          name: string
          name_en?: string | null
          product_type?: string
          sku?: string | null
          stock_quantity?: number
          tenant_id: string
          track_stock?: boolean
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          barcode?: string | null
          branch_id?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          name?: string
          name_en?: string | null
          product_type?: string
          sku?: string | null
          stock_quantity?: number
          tenant_id?: string
          track_stock?: boolean
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          full_name_en: string | null
          id: string
          is_active: boolean
          job_title: string | null
          language: string
          last_login_at: string | null
          phone: string | null
          tenant_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          full_name_en?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          language?: string
          last_login_at?: string | null
          phone?: string | null
          tenant_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          language?: string
          last_login_at?: string | null
          phone?: string | null
          tenant_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_centers: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profit_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profit_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          line_total: number
          product_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          sort_order: number
          tenant_id: string
          unit: string | null
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          line_total?: number
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          received_quantity?: number
          sort_order?: number
          tenant_id: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          line_total?: number
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          sort_order?: number
          tenant_id?: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "ap_aging_view"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          converted_grn_id: string | null
          created_at: string
          created_by: string
          currency: string
          delivered_at: string | null
          delivery_status: string
          discount_total: number
          expected_delivery_date: string | null
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          order_number: string
          rejection_reason: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          vat_total: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_grn_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          delivered_at?: string | null
          delivery_status?: string
          discount_total?: number
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          rejection_reason?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
          vat_total?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_grn_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          delivered_at?: string | null
          delivery_status?: string
          discount_total?: number
          expected_delivery_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          rejection_reason?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_converted_grn_id_fkey"
            columns: ["converted_grn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          quotation_id: string
          sort_order: number
          tenant_id: string
          unit: string | null
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quotation_id: string
          sort_order?: number
          tenant_id: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          sort_order?: number
          tenant_id?: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          converted_invoice_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          discount_total: number
          grand_total: number
          id: string
          notes: string | null
          quotation_number: string
          status: string
          subtotal: number
          tenant_id: string
          title: string
          updated_at: string
          valid_until: string | null
          vat_total: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          notes?: string | null
          quotation_number: string
          status?: string
          subtotal?: number
          tenant_id: string
          title?: string
          updated_at?: string
          valid_until?: string | null
          vat_total?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          notes?: string | null
          quotation_number?: string
          status?: string
          subtotal?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          id: string
          key: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          key: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          key?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      reconciliation_issues: {
        Row: {
          actual_value: number | null
          created_at: string
          description: string
          description_en: string | null
          difference: number | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          expected_value: number | null
          id: string
          is_resolved: boolean
          issue_type: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          severity: string
          tenant_id: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          description: string
          description_en?: string | null
          difference?: number | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          expected_value?: number | null
          id?: string
          is_resolved?: boolean
          issue_type: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          severity?: string
          tenant_id: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          description?: string
          description_en?: string | null
          difference?: number | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          expected_value?: number | null
          id?: string
          is_resolved?: boolean
          issue_type?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          severity?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_issues_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_issues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          critical_count: number
          date_from: string | null
          date_to: string | null
          id: string
          info_count: number
          run_type: string
          started_at: string
          status: string
          summary: Json | null
          tenant_id: string
          total_checked: number
          total_issues: number
          total_matched: number
          triggered_by: string | null
          warning_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          date_from?: string | null
          date_to?: string | null
          id?: string
          info_count?: number
          run_type: string
          started_at?: string
          status?: string
          summary?: Json | null
          tenant_id: string
          total_checked?: number
          total_issues?: number
          total_matched?: number
          triggered_by?: string | null
          warning_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          date_from?: string | null
          date_to?: string | null
          id?: string
          info_count?: number
          run_type?: string
          started_at?: string
          status?: string
          summary?: Json | null
          tenant_id?: string
          total_checked?: number
          total_issues?: number
          total_matched?: number
          triggered_by?: string | null
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          report_key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          report_key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          report_key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_presets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          created_at: string
          date_range: string
          filters: Json
          generated_by: string
          generated_by_name: string
          has_critical_issues: boolean
          id: string
          report_key: string
          report_name_ar: string
          row_count: number
          tenant_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          date_range?: string
          filters?: Json
          generated_by: string
          generated_by_name?: string
          has_critical_issues?: boolean
          id?: string
          report_key: string
          report_name_ar: string
          row_count?: number
          tenant_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          date_range?: string
          filters?: Json
          generated_by?: string
          generated_by_name?: string
          has_critical_issues?: boolean
          id?: string
          report_key?: string
          report_name_ar?: string
          row_count?: number
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          fulfilled_quantity: number
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          reserved_quantity: number
          sales_order_id: string
          sort_order: number
          tenant_id: string
          unit: string | null
          unit_price: number
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number
          fulfilled_quantity?: number
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          reserved_quantity?: number
          sales_order_id: string
          sort_order?: number
          tenant_id: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          fulfilled_quantity?: number
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          reserved_quantity?: number
          sales_order_id?: string
          sort_order?: number
          tenant_id?: string
          unit?: string | null
          unit_price?: number
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          branch_id: string | null
          cancelled_at: string | null
          converted_delivery_note_id: string | null
          converted_invoice_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          discount_total: number
          expected_delivery_date: string | null
          fulfilled_at: string | null
          fulfillment_status: string
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          order_number: string
          quotation_id: string | null
          status: string
          subtotal: number
          tenant_id: string
          title: string
          updated_at: string
          vat_total: number
        }
        Insert: {
          branch_id?: string | null
          cancelled_at?: string | null
          converted_delivery_note_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          expected_delivery_date?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          quotation_id?: string | null
          status?: string
          subtotal?: number
          tenant_id: string
          title?: string
          updated_at?: string
          vat_total?: number
        }
        Update: {
          branch_id?: string | null
          cancelled_at?: string | null
          converted_delivery_note_id?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          discount_total?: number
          expected_delivery_date?: string | null
          fulfilled_at?: string | null
          fulfillment_status?: string
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          quotation_id?: string | null
          status?: string
          subtotal?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_converted_delivery_note_id_fkey"
            columns: ["converted_delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string
          filters: Json | null
          format: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          recipients: string[]
          report_name: string
          report_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          filters?: Json | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_name?: string
          report_type?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          filters?: Json | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          recipients?: string[]
          report_name?: string
          report_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string
          device_info: Json | null
          event_type: string
          id: string
          ip_address: string | null
          is_resolved: boolean
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          device_info?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          is_resolved?: boolean
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          device_info?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          is_resolved?: boolean
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_verified: boolean
          tenant_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_verified?: boolean
          tenant_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_verified?: boolean
          tenant_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movement_type: string
          new_quantity: number
          notes: string | null
          previous_quantity: number
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movement_type: string
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: string
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_items: {
        Row: {
          counted_qty: number | null
          difference: number | null
          id: string
          notes: string | null
          product_id: string
          sort_order: number
          stocktake_id: string
          system_qty: number
          tenant_id: string
          variant_id: string | null
        }
        Insert: {
          counted_qty?: number | null
          difference?: number | null
          id?: string
          notes?: string | null
          product_id: string
          sort_order?: number
          stocktake_id: string
          system_qty?: number
          tenant_id: string
          variant_id?: string | null
        }
        Update: {
          counted_qty?: number | null
          difference?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          sort_order?: number
          stocktake_id?: string
          system_qty?: number
          tenant_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_items_stocktake_id_fkey"
            columns: ["stocktake_id"]
            isOneToOne: false
            referencedRelation: "stocktakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktakes: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          status: string
          stocktake_date: string
          stocktake_number: string
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          status?: string
          stocktake_date?: string
          stocktake_number: string
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          status?: string
          stocktake_date?: string
          stocktake_number?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktakes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktakes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_discount_usage: {
        Row: {
          amount_after: number
          amount_before: number
          discount_id: string
          id: string
          subscription_id: string
          tenant_id: string
          used_at: string
        }
        Insert: {
          amount_after: number
          amount_before: number
          discount_id: string
          id?: string
          subscription_id: string
          tenant_id: string
          used_at?: string
        }
        Update: {
          amount_after?: number
          amount_before?: number
          discount_id?: string
          id?: string
          subscription_id?: string
          tenant_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_discount_usage_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "subscription_discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_discount_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_discount_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_discounts: {
        Row: {
          code: string
          created_at: string
          created_by: string
          discount_type: string
          discount_value: number
          eligible_plan_ids: string[] | null
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number | null
          starts_at: string
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          discount_type?: string
          discount_value: number
          eligible_plan_ids?: string[] | null
          expires_at: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          discount_type?: string
          discount_value?: number
          eligible_plan_ids?: string[] | null
          expires_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number | null
          starts_at?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      subscription_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_billing_cycle: string | null
          new_plan_id: string | null
          new_status: string | null
          notes: string | null
          old_billing_cycle: string | null
          old_plan_id: string | null
          old_status: string | null
          performed_by: string
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_billing_cycle?: string | null
          new_plan_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_billing_cycle?: string | null
          old_plan_id?: string | null
          old_status?: string | null
          performed_by: string
          subscription_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_billing_cycle?: string | null
          new_plan_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_billing_cycle?: string | null
          old_plan_id?: string | null
          old_status?: string | null
          performed_by?: string
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_logs_new_plan_id_fkey"
            columns: ["new_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_logs_old_plan_id_fkey"
            columns: ["old_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json
          grace_period_days: number
          id: string
          is_active: boolean
          max_employees: number | null
          max_invoices: number | null
          max_storage_gb: number | null
          max_users: number | null
          name_ar: string
          name_en: string
          price_monthly: number
          price_quarterly: number | null
          price_yearly: number | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          features?: Json
          grace_period_days?: number
          id?: string
          is_active?: boolean
          max_employees?: number | null
          max_invoices?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name_ar: string
          name_en: string
          price_monthly?: number
          price_quarterly?: number | null
          price_yearly?: number | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          features?: Json
          grace_period_days?: number
          id?: string
          is_active?: boolean
          max_employees?: number | null
          max_invoices?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name_ar?: string
          name_en?: string
          price_monthly?: number
          price_quarterly?: number | null
          price_yearly?: number | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscription_upgrade_requests: {
        Row: {
          amount: number
          bank_reference: string | null
          billing_cycle: string
          created_at: string
          discount_code: string | null
          discount_id: string | null
          id: string
          notes: string | null
          payment_method: string
          plan_id: string
          receipt_filename: string | null
          receipt_url: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bank_reference?: string | null
          billing_cycle?: string
          created_at?: string
          discount_code?: string | null
          discount_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          plan_id: string
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          billing_cycle?: string
          created_at?: string
          discount_code?: string | null
          discount_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          plan_id?: string
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_upgrade_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_upgrade_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          deleted_at: string | null
          deleted_by: string | null
          grace_ends_at: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          deleted_at?: string | null
          deleted_by?: string | null
          grace_ends_at?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          deleted_at?: string | null
          deleted_by?: string | null
          grace_ends_at?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          converted_expense_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          due_date: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          is_spam: boolean | null
          notes: string | null
          ocr_data: Json | null
          ocr_error: string | null
          ocr_status: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spam_score: number | null
          status: string
          subtotal: number | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_vat_number: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string
          uploaded_by: string
          vat_amount: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_expense_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_spam?: boolean | null
          notes?: string | null
          ocr_data?: Json | null
          ocr_error?: string | null
          ocr_status?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spam_score?: number | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_vat_number?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string
          uploaded_by: string
          vat_amount?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          converted_expense_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          due_date?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_spam?: boolean | null
          notes?: string | null
          ocr_data?: Json | null
          ocr_error?: string | null
          ocr_status?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spam_score?: number | null
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          supplier_vat_number?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string
          uploaded_by?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_converted_expense_id_fkey"
            columns: ["converted_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          branch_id: string | null
          contact_name: string | null
          cr_number: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_id?: string | null
          contact_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          branch_id?: string | null
          contact_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          closed_at: string | null
          created_at: string
          created_by: string
          customer_email: string | null
          customer_name: string | null
          id: string
          priority: string
          resolved_at: string | null
          scope: string
          status: string
          subject: string
          tenant_id: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          scope?: string
          status?: string
          subject: string
          tenant_id: string
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          scope?: string
          status?: string
          subject?: string
          tenant_id?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          subject_template: string | null
          template_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          subject_template?: string | null
          template_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          subject_template?: string | null
          template_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_email_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_template_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_entitlements_cache: {
        Row: {
          computed_at: string
          entitlements: Json
          plan_id: string | null
          tenant_id: string
          version: number
        }
        Insert: {
          computed_at?: string
          entitlements?: Json
          plan_id?: string | null
          tenant_id: string
          version?: number
        }
        Update: {
          computed_at?: string
          entitlements?: Json
          plan_id?: string | null
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlements_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_feature_overrides: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          notes: string | null
          overridden_by: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          overridden_by: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          notes?: string | null
          overridden_by?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          id: string
          integration_type: string
          is_enabled: boolean
          last_sync_at: string | null
          last_sync_status: string | null
          sync_inventory: boolean
          sync_sales: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          integration_type: string
          is_enabled?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          sync_inventory?: boolean
          sync_sales?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          integration_type?: string
          is_enabled?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          sync_inventory?: boolean
          sync_sales?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_marketing_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          provider: string
          secrets_encrypted: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          provider: string
          secrets_encrypted?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          provider?: string
          secrets_encrypted?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          severity: string
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          severity?: string
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          severity?: string
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_providers: {
        Row: {
          created_at: string
          credentials_encrypted: string
          environment: string
          fees_fixed: number
          fees_percentage: number
          id: string
          last_tested_at: string | null
          provider: string
          status: string
          tenant_id: string
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          created_at?: string
          credentials_encrypted?: string
          environment?: string
          fees_fixed?: number
          fees_percentage?: number
          id?: string
          last_tested_at?: string | null
          provider: string
          status?: string
          tenant_id: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          created_at?: string
          credentials_encrypted?: string
          environment?: string
          fees_fixed?: number
          fees_percentage?: number
          id?: string
          last_tested_at?: string | null
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: []
      }
      tenant_settings: {
        Row: {
          branding_config: Json
          created_at: string
          email_preferences: Json | null
          id: string
          security_settings: Json | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          branding_config?: Json
          created_at?: string
          email_preferences?: Json | null
          id?: string
          security_settings?: Json | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          branding_config?: Json
          created_at?: string
          email_preferences?: Json | null
          id?: string
          security_settings?: Json | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_sso_settings: {
        Row: {
          auto_provisioning_enabled: boolean
          cert: string | null
          client_id: string | null
          client_secret_encrypted: string | null
          created_at: string
          default_role_id: string | null
          enabled: boolean
          entry_point: string | null
          id: string
          issuer: string | null
          provider_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          auto_provisioning_enabled?: boolean
          cert?: string | null
          client_id?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          default_role_id?: string | null
          enabled?: boolean
          entry_point?: string | null
          id?: string
          issuer?: string | null
          provider_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          auto_provisioning_enabled?: boolean
          cert?: string | null
          client_id?: string | null
          client_secret_encrypted?: string | null
          created_at?: string
          default_role_id?: string | null
          enabled?: boolean
          entry_point?: string | null
          id?: string
          issuer?: string | null
          provider_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_sso_settings_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_sso_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_wallets: {
        Row: {
          balance_available: number
          balance_pending: number
          created_at: string
          currency: string
          id: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          currency?: string
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          additional_number: string | null
          address_city: string | null
          address_district: string | null
          address_street: string | null
          address_zip: string | null
          brand_font: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          building_number: string | null
          compliance_verified_at: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          name_en: string | null
          parent_tenant_id: string | null
          paylink_enabled: boolean
          paylink_enabled_at: string | null
          phone: string | null
          referral_code: string | null
          slug: string
          stamp_company_name: string | null
          stamp_cr_number: string | null
          stamp_enabled: boolean
          stamp_image_url: string | null
          stamp_vat_number: string | null
          status: string
          tenant_type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
          vat_number: string | null
          vat_percentage: number
          vat_registered: boolean
          zatca_compliance_csid: string | null
          zatca_environment: string | null
          zatca_integration_id: string | null
          zatca_otp: string | null
          zatca_phase1_enabled: boolean
          zatca_phase2_ready: boolean
          zatca_production_csid: string | null
          zatca_request_id: string | null
        }
        Insert: {
          additional_number?: string | null
          address_city?: string | null
          address_district?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          building_number?: string | null
          compliance_verified_at?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          name_en?: string | null
          parent_tenant_id?: string | null
          paylink_enabled?: boolean
          paylink_enabled_at?: string | null
          phone?: string | null
          referral_code?: string | null
          slug: string
          stamp_company_name?: string | null
          stamp_cr_number?: string | null
          stamp_enabled?: boolean
          stamp_image_url?: string | null
          stamp_vat_number?: string | null
          status?: string
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
          vat_number?: string | null
          vat_percentage?: number
          vat_registered?: boolean
          zatca_compliance_csid?: string | null
          zatca_environment?: string | null
          zatca_integration_id?: string | null
          zatca_otp?: string | null
          zatca_phase1_enabled?: boolean
          zatca_phase2_ready?: boolean
          zatca_production_csid?: string | null
          zatca_request_id?: string | null
        }
        Update: {
          additional_number?: string | null
          address_city?: string | null
          address_district?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          building_number?: string | null
          compliance_verified_at?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          name_en?: string | null
          parent_tenant_id?: string | null
          paylink_enabled?: boolean
          paylink_enabled_at?: string | null
          phone?: string | null
          referral_code?: string | null
          slug?: string
          stamp_company_name?: string | null
          stamp_cr_number?: string | null
          stamp_enabled?: boolean
          stamp_image_url?: string | null
          stamp_vat_number?: string | null
          status?: string
          tenant_type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
          vat_number?: string | null
          vat_percentage?: number
          vat_registered?: boolean
          zatca_compliance_csid?: string | null
          zatca_environment?: string | null
          zatca_integration_id?: string | null
          zatca_otp?: string | null
          zatca_phase1_enabled?: boolean
          zatca_phase2_ready?: boolean
          zatca_production_csid?: string | null
          zatca_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          content: string
          created_at: string
          id: string
          is_internal_note: boolean
          sender_email: string | null
          sender_name: string | null
          sender_type: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_daily: {
        Row: {
          avg_response_ms: number | null
          created_at: string
          date: string
          id: string
          service_id: string
          successful_checks: number
          total_checks: number
          uptime_percent: number
        }
        Insert: {
          avg_response_ms?: number | null
          created_at?: string
          date: string
          id?: string
          service_id: string
          successful_checks?: number
          total_checks?: number
          uptime_percent?: number
        }
        Update: {
          avg_response_ms?: number | null
          created_at?: string
          date?: string
          id?: string
          service_id?: string
          successful_checks?: number
          total_checks?: number
          uptime_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "uptime_daily_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "platform_services"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_receipts: {
        Row: {
          id: string
          invoice_number: string
          issued_at: string
          pdf_url: string | null
          tenant_id: string
          wallet_transaction_id: string
        }
        Insert: {
          id?: string
          invoice_number: string
          issued_at?: string
          pdf_url?: string | null
          tenant_id: string
          wallet_transaction_id: string
        }
        Update: {
          id?: string
          invoice_number?: string
          issued_at?: string
          pdf_url?: string | null
          tenant_id?: string
          wallet_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_receipts_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_topup_requests: {
        Row: {
          amount: number
          bank_reference: string | null
          created_at: string
          created_by: string
          id: string
          payment_method: string
          receipt_filename: string | null
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenant_id: string
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          created_at?: string
          created_by: string
          id?: string
          payment_method?: string
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          created_at?: string
          created_by?: string
          id?: string
          payment_method?: string
          receipt_filename?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topup_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_topup_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "tenant_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          reason: string
          reference_id: string
          reference_type: string
          source: string
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reason: string
          reference_id: string
          reference_type: string
          source: string
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          reason?: string
          reference_id?: string
          reference_type?: string
          source?: string
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "tenant_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_transfer_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          sort_order: number
          tenant_id: string
          transfer_id: string
          variant_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          sort_order?: number
          tenant_id: string
          transfer_id: string
          variant_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          sort_order?: number
          tenant_id?: string
          transfer_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfer_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "warehouse_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfer_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_transfers: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          from_warehouse_id: string
          id: string
          notes: string | null
          status: string
          tenant_id: string
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          from_warehouse_id: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          to_warehouse_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          to_warehouse_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          branch_id: string | null
          code: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          is_default: boolean
          manager_id: string | null
          name: string
          name_en: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          code?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_id?: string | null
          name: string
          name_en?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          manager_id?: string | null
          name?: string
          name_en?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payload: Json | null
          payload_hash: string | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
          provider_response: Json | null
          raw_headers: Json | null
          received_at: string
          signature_valid: boolean | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payload?: Json | null
          payload_hash?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id?: string | null
          provider_response?: Json | null
          raw_headers?: Json | null
          received_at?: string
          signature_valid?: boolean | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payload?: Json | null
          payload_hash?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_response?: Json | null
          raw_headers?: Json | null
          received_at?: string
          signature_valid?: boolean | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_steps: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          comment: string | null
          created_at: string
          due_at: string | null
          id: string
          instance_id: string
          sla_status: string
          status: Database["public"]["Enums"]["wf_step_status"]
          step_id: string
          step_order: number
          tenant_id: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          comment?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instance_id: string
          sla_status?: string
          status?: Database["public"]["Enums"]["wf_step_status"]
          step_id: string
          step_order: number
          tenant_id: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          comment?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          instance_id?: string
          sla_status?: string
          status?: Database["public"]["Enums"]["wf_step_status"]
          step_id?: string
          step_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_steps_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          completed_at: string | null
          current_step_order: number
          entity_id: string
          entity_type: string
          id: string
          started_at: string
          started_by: string
          status: Database["public"]["Enums"]["wf_instance_status"]
          tenant_id: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step_order?: number
          entity_id: string
          entity_type: string
          id?: string
          started_at?: string
          started_by: string
          status?: Database["public"]["Enums"]["wf_instance_status"]
          tenant_id: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          current_step_order?: number
          entity_id?: string
          entity_type?: string
          id?: string
          started_at?: string
          started_by?: string
          status?: Database["public"]["Enums"]["wf_instance_status"]
          tenant_id?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          auto_condition: Json | null
          created_at: string
          id: string
          is_required: boolean
          name: string
          name_en: string | null
          permission_required: string | null
          role_required: string | null
          step_order: number
          tenant_id: string
          timeout_hours: number | null
          type: Database["public"]["Enums"]["wf_step_type"]
          workflow_id: string
        }
        Insert: {
          auto_condition?: Json | null
          created_at?: string
          id?: string
          is_required?: boolean
          name: string
          name_en?: string | null
          permission_required?: string | null
          role_required?: string | null
          step_order?: number
          tenant_id: string
          timeout_hours?: number | null
          type?: Database["public"]["Enums"]["wf_step_type"]
          workflow_id: string
        }
        Update: {
          auto_condition?: Json | null
          created_at?: string
          id?: string
          is_required?: boolean
          name?: string
          name_en?: string | null
          permission_required?: string | null
          role_required?: string | null
          step_order?: number
          tenant_id?: string
          timeout_hours?: number | null
          type?: Database["public"]["Enums"]["wf_step_type"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition_json: Json
          id: string
          is_published: boolean
          published_at: string | null
          published_by: string | null
          tenant_id: string
          version: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition_json?: Json
          id?: string
          is_published?: boolean
          published_at?: string | null
          published_by?: string | null
          tenant_id: string
          version?: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition_json?: Json
          id?: string
          is_published?: boolean
          published_at?: string | null
          published_by?: string | null
          tenant_id?: string
          version?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          entity_type: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_certificates: {
        Row: {
          certificate: string | null
          certificate_type: string
          created_at: string
          created_by: string
          csid: string
          environment: string
          expires_at: string | null
          id: string
          is_active: boolean
          issued_at: string | null
          private_key_encrypted: string | null
          private_key_kid: string | null
          request_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          certificate?: string | null
          certificate_type: string
          created_at?: string
          created_by: string
          csid: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          issued_at?: string | null
          private_key_encrypted?: string | null
          private_key_kid?: string | null
          request_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          certificate?: string | null
          certificate_type?: string
          created_at?: string
          created_by?: string
          csid?: string
          environment?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          issued_at?: string | null
          private_key_encrypted?: string | null
          private_key_kid?: string | null
          request_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zatca_certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_icv_counter: {
        Row: {
          last_icv: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          last_icv?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          last_icv?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zatca_icv_counter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_settings: {
        Row: {
          auto_renew: boolean
          created_at: string
          credential_metadata: Json
          id: string
          last_credential_refresh: string | null
          last_error: string | null
          tenant_id: string
          updated_at: string
          zatca_status: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          credential_metadata?: Json
          id?: string
          last_credential_refresh?: string | null
          last_error?: string | null
          tenant_id: string
          updated_at?: string
          zatca_status?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          credential_metadata?: Json
          id?: string
          last_credential_refresh?: string | null
          last_error?: string | null
          tenant_id?: string
          updated_at?: string
          zatca_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zatca_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_submission_log: {
        Row: {
          certificate_used: string | null
          digital_signature: string | null
          errors: Json | null
          http_status: number | null
          id: string
          invoice_hash: string
          invoice_id: string
          invoice_uuid: string
          request_payload: Json | null
          response_payload: Json | null
          signed_xml: string | null
          submission_type: string
          submitted_at: string
          submitted_by: string
          tenant_id: string
          warnings: Json | null
          zatca_status: string | null
        }
        Insert: {
          certificate_used?: string | null
          digital_signature?: string | null
          errors?: Json | null
          http_status?: number | null
          id?: string
          invoice_hash: string
          invoice_id: string
          invoice_uuid: string
          request_payload?: Json | null
          response_payload?: Json | null
          signed_xml?: string | null
          submission_type: string
          submitted_at?: string
          submitted_by: string
          tenant_id: string
          warnings?: Json | null
          zatca_status?: string | null
        }
        Update: {
          certificate_used?: string | null
          digital_signature?: string | null
          errors?: Json | null
          http_status?: number | null
          id?: string
          invoice_hash?: string
          invoice_id?: string
          invoice_uuid?: string
          request_payload?: Json | null
          response_payload?: Json | null
          signed_xml?: string | null
          submission_type?: string
          submitted_at?: string
          submitted_by?: string
          tenant_id?: string
          warnings?: Json | null
          zatca_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zatca_submission_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_view"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "zatca_submission_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zatca_submission_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ap_aging_view: {
        Row: {
          aging_bucket: string | null
          branch_id: string | null
          currency: string | null
          days_overdue: number | null
          due_date: string | null
          grand_total: number | null
          ledger_balance: number | null
          order_number: string | null
          purchase_order_id: string | null
          supplier_id: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_aging_view: {
        Row: {
          aging_bucket: string | null
          amount_due: number | null
          branch_id: string | null
          currency: string | null
          customer_id: string | null
          days_overdue: number | null
          due_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          ledger_balance: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_sheet_view: {
        Row: {
          account_name: string | null
          balance: number | null
          branch_id: string | null
          category: string | null
          tenant_id: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_view: {
        Row: {
          branch_id: string | null
          cash_in: number | null
          cash_out: number | null
          net_cash: number | null
          period: string | null
          source_type: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_summary_view: {
        Row: {
          account_name: string | null
          branch_id: string | null
          net_expense: number | null
          period: string | null
          source_type: string | null
          tenant_id: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_loss_view: {
        Row: {
          branch_id: string | null
          category: string | null
          expenses: number | null
          net_profit: number | null
          period: string | null
          revenue: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_summary_view: {
        Row: {
          account_name: string | null
          branch_id: string | null
          net_revenue: number | null
          period: string | null
          tenant_id: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_revenue_view: {
        Row: {
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          current_period_end: string | null
          current_period_start: string | null
          plan_name: string | null
          price_monthly: number | null
          price_yearly: number | null
          recurring_amount: number | null
          subscribed_at: string | null
          subscription_status: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_summary_view: {
        Row: {
          account_name: string | null
          branch_id: string | null
          net_vat_payable: number | null
          period: string | null
          source_type: string | null
          tenant_id: string | null
          vat_input: number | null
          vat_output: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_activity_view: {
        Row: {
          period: string | null
          reason: string | null
          source: string | null
          tenant_id: string | null
          total_amount: number | null
          total_credits: number | null
          total_debits: number | null
          transaction_count: number | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      zatca_certificates_safe: {
        Row: {
          certificate: string | null
          certificate_type: string | null
          created_at: string | null
          created_by: string | null
          csid: string | null
          environment: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          is_key_encrypted: boolean | null
          issued_at: string | null
          key_status: string | null
          private_key_kid: string | null
          request_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          certificate?: string | null
          certificate_type?: string | null
          created_at?: string | null
          created_by?: string | null
          csid?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_key_encrypted?: never
          issued_at?: string | null
          key_status?: never
          private_key_kid?: string | null
          request_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          certificate?: string | null
          certificate_type?: string | null
          created_at?: string | null
          created_by?: string | null
          csid?: string | null
          environment?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_key_encrypted?: never
          issued_at?: string | null
          key_status?: never
          private_key_kid?: string | null
          request_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zatca_certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_budget: { Args: { p_budget_id: string }; Returns: Json }
      admin_review_topup_request: {
        Args: {
          p_action: string
          p_rejection_reason?: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_set_wallet_status: {
        Args: { p_admin_id: string; p_status: string; p_wallet_id: string }
        Returns: undefined
      }
      apply_subscription_discount: {
        Args: { _code: string; _plan_id: string; _tenant_id: string }
        Returns: Json
      }
      approve_matured_commissions: { Args: never; Returns: number }
      assert_platform_admin: { Args: never; Returns: undefined }
      assert_tenant_admin: { Args: { p_tenant_id: string }; Returns: undefined }
      assert_tenant_member: {
        Args: { p_roles?: string[]; p_tenant_id: string }
        Returns: undefined
      }
      auto_activate_enterprise_integrations: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: undefined
      }
      budget_incremental_update: {
        Args: {
          p_line_type: string
          p_month: number
          p_tenant_id: string
          p_year: number
        }
        Returns: undefined
      }
      calculate_paylink_fee: {
        Args: { _gross_amount: number; _tenant_id: string }
        Returns: {
          fee_amount: number
          fee_fixed: number
          fee_percentage: number
          fee_type: string
          net_amount: number
        }[]
      }
      cancel_affiliate_commissions: {
        Args: { _reason?: string; _subscription_id: string }
        Returns: Json
      }
      check_account_locked: { Args: { p_email: string }; Returns: boolean }
      check_entitlement: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: Json
      }
      check_entitlements_bulk: {
        Args: { _feature_keys: string[]; _tenant_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_block_seconds?: number
          p_key: string
          p_max_requests: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      check_sla_deadlines: { Args: never; Returns: undefined }
      check_storage_limit: {
        Args: { _file_size_bytes?: number; _tenant_id: string }
        Returns: Json
      }
      check_subscription_integrity: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      claim_next_job: {
        Args: { p_job_types?: string[] }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "background_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      classify_account: { Args: { p_account_name: string }; Returns: string }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      complete_job: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: undefined
      }
      create_document_access_token: {
        Args: {
          _document_id: string
          _document_type: string
          _hours?: number
          _max_access?: number
          _tenant_id: string
        }
        Returns: string
      }
      encrypt_zatca_private_key: {
        Args: { p_cert_id: string; p_master_key: string; p_private_key: string }
        Returns: undefined
      }
      enforce_feature_entitlement: {
        Args: { _feature_key: string; _tenant_id: string }
        Returns: boolean
      }
      fail_job: {
        Args: { p_error?: string; p_job_id: string }
        Returns: undefined
      }
      generate_api_key: {
        Args: { _name?: string; _scopes?: string[]; _tenant_id: string }
        Returns: Json
      }
      generate_inventory_number: {
        Args: { p_prefix: string; p_tenant_id: string }
        Returns: string
      }
      generate_recurring_commissions: { Args: never; Returns: Json }
      generate_smart_notifications: { Args: never; Returns: undefined }
      get_consolidated_balance_sheet: {
        Args: { _as_of_date?: string; _parent_tenant_id: string }
        Returns: {
          account_name: string
          balance: number
          category: string
          is_intercompany: boolean
          tenant_id: string
          tenant_name: string
          total_credit: number
          total_debit: number
        }[]
      }
      get_consolidated_pl: {
        Args: {
          _date_from?: string
          _date_to?: string
          _parent_tenant_id: string
        }
        Returns: {
          account_name: string
          category: string
          is_intercompany: boolean
          net_amount: number
          tenant_id: string
          tenant_name: string
          total_credit: number
          total_debit: number
        }[]
      }
      get_edge_latency_by_function: { Args: { _since?: string }; Returns: Json }
      get_edge_latency_percentiles: { Args: { _since?: string }; Returns: Json }
      get_entitlements_cached: { Args: { p_tenant_id: string }; Returns: Json }
      get_exchange_rate: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: number
      }
      get_group_subsidiaries: {
        Args: { _parent_tenant_id: string }
        Returns: {
          cr_number: string
          created_at: string
          id: string
          industry: string
          name: string
          name_en: string
          status: string
          vat_number: string
        }[]
      }
      get_group_summary: { Args: { _parent_tenant_id: string }; Returns: Json }
      get_integration_secrets_for_edge_only: {
        Args: {
          p_integration_id: string
          p_master_key: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_metric_breakdown: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_metric_key: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_my_permissions: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: string[]
      }
      get_next_icv: { Args: { _tenant_id: string }; Returns: number }
      get_tenant_usage_summary: { Args: { _tenant_id: string }; Returns: Json }
      get_user_branch_ids: { Args: { _tenant_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: never; Returns: string }
      get_zatca_private_key: {
        Args: { p_cert_id: string; p_master_key: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authorized_contracts: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      is_authorized_finance: { Args: { _tenant_id: string }; Returns: boolean }
      is_authorized_hr: { Args: { _tenant_id: string }; Returns: boolean }
      is_branch_member: { Args: { _branch_id: string }; Returns: boolean }
      is_group_admin: {
        Args: { _parent_tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_period_locked: {
        Args: { _date: string; _tenant_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_owner: { Args: { _tenant_id: string }; Returns: boolean }
      lock_affiliate_commission: {
        Args: { _cooling_days?: number; _subscription_id: string }
        Returns: Json
      }
      lookup_sso_by_domain: {
        Args: { p_domain: string }
        Returns: {
          client_id: string
          entry_point: string
          issuer: string
          provider_type: string
          tenant_id: string
        }[]
      }
      mark_entitlements_dirty: {
        Args: { p_reason?: string; p_tenant_id: string }
        Returns: undefined
      }
      process_affiliate_commission: {
        Args: {
          _paid_amount: number
          _plan_id: string
          _subscription_id: string
          _tenant_id: string
        }
        Returns: Json
      }
      process_affiliate_payout: {
        Args: { _action: string; _admin_notes?: string; _payout_id: string }
        Returns: Json
      }
      process_inventory_movement: {
        Args: {
          p_created_by: string
          p_movement_type: string
          p_notes: string
          p_product_id: string
          p_quantity: number
          p_reference_id: string
          p_reference_type: string
          p_tenant_id: string
          p_transfer_id: string
          p_unit_cost: number
          p_variant_id: string
          p_warehouse_id: string
        }
        Returns: string
      }
      process_scheduled_affiliate_payouts: { Args: never; Returns: Json }
      process_subscription_expiry: { Args: never; Returns: undefined }
      process_wallet_transaction: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_reason: string
          p_reference_id: string
          p_reference_type: string
          p_source: string
          p_type: string
          p_wallet_id: string
        }
        Returns: string
      }
      query_analytics_view: {
        Args: {
          _branch_id?: string
          _columns?: string[]
          _group_by?: string[]
          _limit?: number
          _period_from?: string
          _period_to?: string
          _sort_by?: string
          _sort_direction?: string
          _tenant_id: string
          _view_name: string
        }
        Returns: Json
      }
      rebuild_tenant_entitlements_cache: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      reconcile_invoices_vs_payments: {
        Args: { p_date_from?: string; p_date_to?: string; p_tenant_id: string }
        Returns: string
      }
      reconcile_invoices_without_journals: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      reconcile_subscription_revenue: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      reconcile_unbalanced_journals: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      reconcile_vat_totals: {
        Args: { p_date_from?: string; p_date_to?: string; p_tenant_id: string }
        Returns: string
      }
      reconcile_wallet_vs_journal: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      record_stock_movement: {
        Args: {
          _created_by?: string
          _movement_type: string
          _notes?: string
          _product_id: string
          _quantity: number
          _reference_id?: string
          _reference_type?: string
          _tenant_id: string
        }
        Returns: undefined
      }
      release_stock_reservation: {
        Args: { _sales_order_id: string; _tenant_id: string }
        Returns: undefined
      }
      request_affiliate_payout: {
        Args: {
          _affiliate_id: string
          _commission_ids?: string[]
          _method?: string
        }
        Returns: Json
      }
      requeue_stale_jobs: { Args: never; Returns: number }
      reserve_stock_for_order: {
        Args: { _sales_order_id: string; _tenant_id: string }
        Returns: undefined
      }
      resolve_email_template: {
        Args: { _email_type: string; _tenant_id?: string }
        Returns: {
          body_html: string
          body_text: string
          sender_key: string
          subject_template: string
          variables: Json
        }[]
      }
      set_integration_secrets: {
        Args: {
          p_actor_id: string
          p_integration_id: string
          p_master_key: string
          p_secrets_json: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      set_tenant_integration_secrets: {
        Args: {
          p_actor_id: string
          p_config_public: Json
          p_integration_type: string
          p_master_key: string
          p_secrets_json: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      sync_budget_actuals_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      update_tenant_settings_cas: {
        Args: {
          p_column?: string
          p_expected_version: number
          p_patch: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      user_has_permission: {
        Args: { _permission_key: string }
        Returns: boolean
      }
      validate_api_key: { Args: { _key_hash: string }; Returns: Json }
      validate_document_token: {
        Args: { _token: string }
        Returns: {
          document_id: string
          document_type: string
          is_valid: boolean
        }[]
      }
      validate_subscription_discount: {
        Args: { _code: string; _plan_id: string; _tenant_id: string }
        Returns: Json
      }
      verify_finance_event_chain: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_tenant_id: string
        }
        Returns: {
          actual_hash: string
          event_id: string
          expected_hash: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "hr" | "accountant" | "member"
      budget_alert_event_status: "triggered" | "acknowledged" | "resolved"
      budget_alert_scope: "budget_total" | "line" | "cost_center" | "department"
      budget_line_type: "revenue" | "expense" | "capex"
      budget_period_type: "monthly" | "quarterly" | "yearly"
      budget_status: "draft" | "active" | "locked" | "archived"
      tenant_type: "company" | "individual" | "freelancer"
      wf_instance_status:
        | "pending"
        | "in_progress"
        | "approved"
        | "rejected"
        | "cancelled"
      wf_step_status:
        | "pending"
        | "approved"
        | "rejected"
        | "skipped"
        | "auto_passed"
      wf_step_type: "approval" | "condition" | "auto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "manager", "hr", "accountant", "member"],
      budget_alert_event_status: ["triggered", "acknowledged", "resolved"],
      budget_alert_scope: ["budget_total", "line", "cost_center", "department"],
      budget_line_type: ["revenue", "expense", "capex"],
      budget_period_type: ["monthly", "quarterly", "yearly"],
      budget_status: ["draft", "active", "locked", "archived"],
      tenant_type: ["company", "individual", "freelancer"],
      wf_instance_status: [
        "pending",
        "in_progress",
        "approved",
        "rejected",
        "cancelled",
      ],
      wf_step_status: [
        "pending",
        "approved",
        "rejected",
        "skipped",
        "auto_passed",
      ],
      wf_step_type: ["approval", "condition", "auto"],
    },
  },
} as const
