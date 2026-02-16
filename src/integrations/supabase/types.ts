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
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
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
          changes?: Json | null
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
          changes?: Json | null
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
          body_html: string
          contract_number: string
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          customer_id: string | null
          end_date: string | null
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
          body_html?: string
          contract_number: string
          contract_type?: string
          created_at?: string
          created_by: string
          currency?: string
          customer_id?: string | null
          end_date?: string | null
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
          body_html?: string
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string | null
          end_date?: string | null
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
      customers: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          cr_number: string | null
          created_at: string
          customer_type: string
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
          cr_number?: string | null
          created_at?: string
          customer_type?: string
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
          cr_number?: string | null
          created_at?: string
          customer_type?: string
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
            foreignKeyName: "customers_tenant_id_fkey"
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
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          created_by: string
          currency: string
          customer_id: string
          discount_total: number
          due_date: string
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string
          notes: string | null
          status: string
          subtotal: number
          supply_date: string
          tenant_id: string
          updated_at: string
          vat_total: number
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          created_by: string
          currency?: string
          customer_id: string
          discount_total?: number
          due_date?: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type?: string
          notes?: string | null
          status?: string
          subtotal?: number
          supply_date?: string
          tenant_id: string
          updated_at?: string
          vat_total?: number
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          created_by?: string
          currency?: string
          customer_id?: string
          discount_total?: number
          due_date?: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          notes?: string | null
          status?: string
          subtotal?: number
          supply_date?: string
          tenant_id?: string
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
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
      products: {
        Row: {
          barcode: string | null
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
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
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
      tenants: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          brand_font: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
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
          phone: string | null
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
          zatca_integration_id: string | null
          zatca_phase1_enabled: boolean
          zatca_phase2_ready: boolean
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
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
          phone?: string | null
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
          zatca_integration_id?: string | null
          zatca_phase1_enabled?: boolean
          zatca_phase2_ready?: boolean
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_font?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
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
          phone?: string | null
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
          zatca_integration_id?: string | null
          zatca_phase1_enabled?: boolean
          zatca_phase2_ready?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: never; Returns: string }
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
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { _tenant_id: string }; Returns: boolean }
      is_tenant_owner: { Args: { _tenant_id: string }; Returns: boolean }
      process_subscription_expiry: { Args: never; Returns: undefined }
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
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "hr" | "accountant" | "member"
      tenant_type: "company" | "individual" | "freelancer"
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
      tenant_type: ["company", "individual", "freelancer"],
    },
  },
} as const
