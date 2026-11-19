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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          created_at: string
          credit_limit: number | null
          cut_day: number
          id: string
          kind: string
          legacy: string | null
          name: string
          pay_day: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          credit_limit?: number | null
          cut_day?: number
          id?: string
          kind?: string
          legacy?: string | null
          name: string
          pay_day?: number
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          credit_limit?: number | null
          cut_day?: number
          id?: string
          kind?: string
          legacy?: string | null
          name?: string
          pay_day?: number
          user_id?: string
        }
        Relationships: []
      }
      bcp_movements: {
        Row: {
          account_id: string | null
          amount: number
          concept: string
          created_at: string
          date: string | null
          id: string
          paid_card_id: string | null
          seq: number
          source: string
          transfer_id: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          concept: string
          created_at?: string
          date?: string | null
          id?: string
          paid_card_id?: string | null
          seq?: number
          source?: string
          transfer_id?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          concept?: string
          created_at?: string
          date?: string | null
          id?: string
          paid_card_id?: string | null
          seq?: number
          source?: string
          transfer_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      debts: {
        Row: {
          created_at: string
          id: string
          monthly_amount: number
          name: string
          num_payments: number | null
          pay_account_id: string | null
          pay_day: number
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_amount: number
          name: string
          num_payments?: number | null
          pay_account_id?: string | null
          pay_day?: number
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_amount?: number
          name?: string
          num_payments?: number | null
          pay_account_id?: string | null
          pay_day?: number
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          account_id: string | null
          concept: string
          created_at: string
          first_date: string
          id: string
          monthly_amount: number
          num_installments: number
          original_amount: number
          purchase_date: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          concept: string
          created_at?: string
          first_date: string
          id?: string
          monthly_amount: number
          num_installments: number
          original_amount: number
          purchase_date?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          concept?: string
          created_at?: string
          first_date?: string
          id?: string
          monthly_amount?: number
          num_installments?: number
          original_amount?: number
          purchase_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      io_expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          source: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bbva_amount: number
          bbva_date: string | null
          created_at: string
          io_cut_day: number
          io_pay_day: number
          mesada1_amount: number
          mesada1_day: number
          mesada2_amount: number
          mesada2_day: number
          projection_months: number
          shortcut_token: string
          user_id: string
          yape_amount: number
          yape_day: number
        }
        Insert: {
          bbva_amount?: number
          bbva_date?: string | null
          created_at?: string
          io_cut_day?: number
          io_pay_day?: number
          mesada1_amount?: number
          mesada1_day?: number
          mesada2_amount?: number
          mesada2_day?: number
          projection_months?: number
          shortcut_token?: string
          user_id: string
          yape_amount?: number
          yape_day?: number
        }
        Update: {
          bbva_amount?: number
          bbva_date?: string | null
          created_at?: string
          io_cut_day?: number
          io_pay_day?: number
          mesada1_amount?: number
          mesada1_day?: number
          mesada2_amount?: number
          mesada2_day?: number
          projection_months?: number
          shortcut_token?: string
          user_id?: string
          yape_amount?: number
          yape_day?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean
          amount: number
          category: string
          charge_day: number
          charge_month: number | null
          created_at: string
          cycle: string
          id: string
          name: string
          pay_account_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          category?: string
          charge_day?: number
          charge_month?: number | null
          created_at?: string
          cycle?: string
          id?: string
          name: string
          pay_account_id?: string | null
          user_id?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          charge_day?: number
          charge_month?: number | null
          created_at?: string
          cycle?: string
          id?: string
          name?: string
          pay_account_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expense_to_installments: {
        Args: { p_expense_id: string; p_first_date: string; p_monthly: number; p_num: number; p_original: number }
        Returns: string
      }
      apply_payment: {
        Args: { p_amount: number; p_currency: string; p_days: number; p_plan: string; p_provider_payment_id: string; p_status: string; p_user: string }
        Returns: boolean
      }
      apply_subscription: {
        Args: { p_paid_until: string | null; p_status: string; p_subscription_id: string; p_user: string }
        Returns: undefined
      }
      init_my_account: { Args: never; Returns: undefined }
      my_plan: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
