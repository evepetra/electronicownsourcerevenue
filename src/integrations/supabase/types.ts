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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      arrears: {
        Row: {
          created_at: string
          days_overdue: number
          due_date: string
          id: string
          invoice_no: string
          original_amount: number
          outstanding_amount: number
          status: string
          taxpayer_id: string
        }
        Insert: {
          created_at?: string
          days_overdue?: number
          due_date: string
          id?: string
          invoice_no: string
          original_amount: number
          outstanding_amount: number
          status?: string
          taxpayer_id: string
        }
        Update: {
          created_at?: string
          days_overdue?: number
          due_date?: string
          id?: string
          invoice_no?: string
          original_amount?: number
          outstanding_amount?: number
          status?: string
          taxpayer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrears_taxpayer_id_fkey"
            columns: ["taxpayer_id"]
            isOneToOne: false
            referencedRelation: "taxpayers"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          fee_schedule_id: string
          id: string
          period: string
          premise_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          fee_schedule_id: string
          id?: string
          period: string
          premise_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          fee_schedule_id?: string
          id?: string
          period?: string
          premise_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_premise_id_fkey"
            columns: ["premise_id"]
            isOneToOne: false
            referencedRelation: "premises"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: string | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          details?: string | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      council_budgets: {
        Row: {
          allocated_amount: number
          category: string
          council_id: string
          created_at: string
          fiscal_year: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          category: string
          council_id: string
          created_at?: string
          fiscal_year: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          category?: string
          council_id?: string
          created_at?: string
          fiscal_year?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_budgets_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      council_meetings: {
        Row: {
          agenda: string | null
          council_id: string
          created_at: string
          id: string
          location: string
          meeting_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          council_id: string
          created_at?: string
          id?: string
          location?: string
          meeting_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          council_id?: string
          created_at?: string
          id?: string
          location?: string
          meeting_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_meetings_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      council_spending: {
        Row: {
          amount: number
          category: string
          council_id: string
          created_at: string
          department: string | null
          description: string
          fiscal_year: string
          id: string
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          council_id: string
          created_at?: string
          department?: string | null
          description?: string
          fiscal_year: string
          id?: string
          spent_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          council_id?: string
          created_at?: string
          department?: string | null
          description?: string
          fiscal_year?: string
          id?: string
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_spending_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      councils: {
        Row: {
          code: string
          created_at: string
          district: string
          email: string
          id: string
          mayor: string | null
          name: string
          phone: string
          physical_address: string
          postal_address: string | null
          town_clerk: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          code: string
          created_at?: string
          district: string
          email?: string
          id?: string
          mayor?: string | null
          name: string
          phone?: string
          physical_address?: string
          postal_address?: string | null
          town_clerk?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          district?: string
          email?: string
          id?: string
          mayor?: string | null
          name?: string
          phone?: string
          physical_address?: string
          postal_address?: string | null
          town_clerk?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      fee_schedules: {
        Row: {
          amount: number
          council_id: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          period: string
          revenue_source: string
        }
        Insert: {
          amount: number
          council_id: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          period?: string
          revenue_source: string
        }
        Update: {
          amount?: number
          council_id?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          period?: string
          revenue_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          assessment_id: string | null
          created_at: string
          due_date: string
          id: string
          invoice_no: string
          issued_date: string
          revenue_source: string
          status: string
          taxpayer_id: string
        }
        Insert: {
          amount: number
          assessment_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_no: string
          issued_date?: string
          revenue_source: string
          status?: string
          taxpayer_id: string
        }
        Update: {
          amount?: number
          assessment_id?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_no?: string
          issued_date?: string
          revenue_source?: string
          status?: string
          taxpayer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_taxpayer_id_fkey"
            columns: ["taxpayer_id"]
            isOneToOne: false
            referencedRelation: "taxpayers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cashier_name: string | null
          channel: string
          created_at: string
          id: string
          invoice_no: string
          payer_ref: string | null
          status: string
        }
        Insert: {
          amount: number
          cashier_name?: string | null
          channel: string
          created_at?: string
          id?: string
          invoice_no: string
          payer_ref?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cashier_name?: string | null
          channel?: string
          created_at?: string
          id?: string
          invoice_no?: string
          payer_ref?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_no_fkey"
            columns: ["invoice_no"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["invoice_no"]
          },
        ]
      }
      premises: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          market: string | null
          name: string
          taxpayer_id: string
          type: string
          ward: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          market?: string | null
          name: string
          taxpayer_id: string
          type?: string
          ward?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          market?: string | null
          name?: string
          taxpayer_id?: string
          type?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premises_taxpayer_id_fkey"
            columns: ["taxpayer_id"]
            isOneToOne: false
            referencedRelation: "taxpayers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          council_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          staff_id: string
        }
        Insert: {
          council_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          staff_id?: string
        }
        Update: {
          council_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          payment_id: string
          qr_token: string
          serial: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id: string
          qr_token: string
          serial: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string
          qr_token?: string
          serial?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      recon_batches: {
        Row: {
          council_id: string
          created_at: string
          file_name: string
          id: string
          matched_lines: number
          source: string
          status: string
          total_lines: number
          unmatched_lines: number
        }
        Insert: {
          council_id: string
          created_at?: string
          file_name: string
          id?: string
          matched_lines?: number
          source: string
          status?: string
          total_lines?: number
          unmatched_lines?: number
        }
        Update: {
          council_id?: string
          created_at?: string
          file_name?: string
          id?: string
          matched_lines?: number
          source?: string
          status?: string
          total_lines?: number
          unmatched_lines?: number
        }
        Relationships: [
          {
            foreignKeyName: "recon_batches_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      recon_items: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          matched_invoice_no: string | null
          statement_amount: number
          statement_date: string
          statement_ref: string
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          matched_invoice_no?: string | null
          statement_amount: number
          statement_date: string
          statement_ref: string
          status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          matched_invoice_no?: string | null
          statement_amount?: number
          statement_date?: string
          statement_ref?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recon_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "recon_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      taxpayers: {
        Row: {
          address: string | null
          council_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          nin: string | null
          phone: string
          taxpayer_code: string
          tin: string | null
          type: string
        }
        Insert: {
          address?: string | null
          council_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          nin?: string | null
          phone?: string
          taxpayer_code: string
          tin?: string | null
          type?: string
        }
        Update: {
          address?: string | null
          council_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          nin?: string | null
          phone?: string
          taxpayer_code?: string
          tin?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxpayers_council_id_fkey"
            columns: ["council_id"]
            isOneToOne: false
            referencedRelation: "councils"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_council: { Args: { _council_id: string }; Returns: boolean }
      claim_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "ADMIN"
        | "REVENUE_OFFICER"
        | "CASHIER"
        | "AUDITOR"
        | "COUNCIL_ADMIN"
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
      app_role: [
        "ADMIN",
        "REVENUE_OFFICER",
        "CASHIER",
        "AUDITOR",
        "COUNCIL_ADMIN",
      ],
    },
  },
} as const
