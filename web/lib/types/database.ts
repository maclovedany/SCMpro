// 자동 생성: engine gen-types — 수정 금지
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  app: {
    Tables: {
      approval: {
        Row: {
          id: string
          kind: Database["app"]["Enums"]["approval_kind"]
          target_table: string
          target_pk: string
          payload: Json
          requested_by: string
          requested_at: string | null
          approver: string | null
          status: Database["app"]["Enums"]["approval_status"]
          reason: string
          comment: string | null
          decided_at: string | null
        }
        Insert: {
          id?: string
          kind?: Database["app"]["Enums"]["approval_kind"]
          target_table?: string
          target_pk?: string
          payload?: Json
          requested_by?: string
          requested_at?: string | null
          approver?: string | null
          status?: Database["app"]["Enums"]["approval_status"]
          reason?: string
          comment?: string | null
          decided_at?: string | null
        }
        Update: {
          id?: string
          kind?: Database["app"]["Enums"]["approval_kind"]
          target_table?: string
          target_pk?: string
          payload?: Json
          requested_by?: string
          requested_at?: string | null
          approver?: string | null
          status?: Database["app"]["Enums"]["approval_status"]
          reason?: string
          comment?: string | null
          decided_at?: string | null
        }
        Relationships: []
      }
      attach_rate: {
        Row: {
          id: number
          model_base: string
          option_item_code: string
          rate: number
          effective_ym: string
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          model_base?: string
          option_item_code?: string
          rate?: number
          effective_ym?: string
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          model_base?: string
          option_item_code?: string
          rate?: number
          effective_ym?: string
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          table_name: string
          row_pk: string | null
          action: string
          before: Json | null
          after: Json | null
          actor: string | null
          at: string | null
        }
        Insert: {
          id?: number
          table_name?: string
          row_pk?: string | null
          action?: string
          before?: Json | null
          after?: Json | null
          actor?: string | null
          at?: string | null
        }
        Update: {
          id?: number
          table_name?: string
          row_pk?: string | null
          action?: string
          before?: Json | null
          after?: Json | null
          actor?: string | null
          at?: string | null
        }
        Relationships: []
      }
      eol_eos: {
        Row: {
          model_base: string
          launch_date: string | null
          eol_date: string | null
          eos_date: string | null
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          model_base?: string
          launch_date?: string | null
          eol_date?: string | null
          eos_date?: string | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          model_base?: string
          launch_date?: string | null
          eol_date?: string | null
          eos_date?: string | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forecast_accuracy: {
        Row: {
          id: number
          run_id: string
          level: string
          key: string
          method: string
          bias: number | null
          wape: number | null
          mape: number | null
          n: number | null
          sum_actual: number | null
          extra: Json | null
        }
        Insert: {
          id?: number
          run_id?: string
          level?: string
          key?: string
          method?: string
          bias?: number | null
          wape?: number | null
          mape?: number | null
          n?: number | null
          sum_actual?: number | null
          extra?: Json | null
        }
        Update: {
          id?: number
          run_id?: string
          level?: string
          key?: string
          method?: string
          bias?: number | null
          wape?: number | null
          mape?: number | null
          n?: number | null
          sum_actual?: number | null
          extra?: Json | null
        }
        Relationships: []
      }
      forecast_method: {
        Row: {
          key: string
          name: string
          family: string
          patterns: string[]
          abc_scope: string[]
          level: string
          min_history: number
          enabled: boolean
          is_baseline: boolean
          params: Json
          sort: number
          description: string | null
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          key?: string
          name?: string
          family?: string
          patterns?: string[]
          abc_scope?: string[]
          level?: string
          min_history?: number
          enabled?: boolean
          is_baseline?: boolean
          params?: Json
          sort?: number
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          key?: string
          name?: string
          family?: string
          patterns?: string[]
          abc_scope?: string[]
          level?: string
          min_history?: number
          enabled?: boolean
          is_baseline?: boolean
          params?: Json
          sort?: number
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forecast_policy: {
        Row: {
          cell: string
          methods: string[]
          min_history: number
          note: string | null
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          cell?: string
          methods?: string[]
          min_history?: number
          note?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          cell?: string
          methods?: string[]
          min_history?: number
          note?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      forecast_result: {
        Row: {
          run_id: string
          level: string
          key_code: string
          category: string | null
          ym: string
          method: string
          value: number | null
          lower: number | null
          upper: number | null
          is_champion: boolean
          actual: number | null
        }
        Insert: {
          run_id?: string
          level?: string
          key_code?: string
          category?: string | null
          ym?: string
          method?: string
          value?: number | null
          lower?: number | null
          upper?: number | null
          is_champion?: boolean
          actual?: number | null
        }
        Update: {
          run_id?: string
          level?: string
          key_code?: string
          category?: string | null
          ym?: string
          method?: string
          value?: number | null
          lower?: number | null
          upper?: number | null
          is_champion?: boolean
          actual?: number | null
        }
        Relationships: []
      }
      forecast_run: {
        Row: {
          id: string
          run_type: Database["app"]["Enums"]["run_type"]
          eval_fy: number | null
          train_from: string | null
          train_to: string | null
          horizon: number | null
          status: Database["app"]["Enums"]["run_status"]
          params_snapshot: Json | null
          summary: Json | null
          error: string | null
          requested_by: string | null
          created_at: string | null
          started_at: string | null
          finished_at: string | null
        }
        Insert: {
          id?: string
          run_type?: Database["app"]["Enums"]["run_type"]
          eval_fy?: number | null
          train_from?: string | null
          train_to?: string | null
          horizon?: number | null
          status?: Database["app"]["Enums"]["run_status"]
          params_snapshot?: Json | null
          summary?: Json | null
          error?: string | null
          requested_by?: string | null
          created_at?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Update: {
          id?: string
          run_type?: Database["app"]["Enums"]["run_type"]
          eval_fy?: number | null
          train_from?: string | null
          train_to?: string | null
          horizon?: number | null
          status?: Database["app"]["Enums"]["run_status"]
          params_snapshot?: Json | null
          summary?: Json | null
          error?: string | null
          requested_by?: string | null
          created_at?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Relationships: []
      }
      forecast_tuning_proposal: {
        Row: {
          id: string
          run_id: string | null
          model: string
          prompt: string | null
          response: Json | null
          status: string
          approval_id: string | null
          created_at: string | null
          applied_at: string | null
          comment: string | null
        }
        Insert: {
          id?: string
          run_id?: string | null
          model?: string
          prompt?: string | null
          response?: Json | null
          status?: string
          approval_id?: string | null
          created_at?: string | null
          applied_at?: string | null
          comment?: string | null
        }
        Update: {
          id?: string
          run_id?: string | null
          model?: string
          prompt?: string | null
          response?: Json | null
          status?: string
          approval_id?: string | null
          created_at?: string | null
          applied_at?: string | null
          comment?: string | null
        }
        Relationships: []
      }
      holiday: {
        Row: {
          date: string
          name: string
          country: string
        }
        Insert: {
          date?: string
          name?: string
          country?: string
        }
        Update: {
          date?: string
          name?: string
          country?: string
        }
        Relationships: []
      }
      inbound: {
        Row: {
          id: number
          item_code: string
          supplier_id: number | null
          po_no: string | null
          qty: number
          planned_date: string
          actual_date: string | null
          status: Database["app"]["Enums"]["inbound_status"]
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          item_code?: string
          supplier_id?: number | null
          po_no?: string | null
          qty?: number
          planned_date?: string
          actual_date?: string | null
          status?: Database["app"]["Enums"]["inbound_status"]
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          item_code?: string
          supplier_id?: number | null
          po_no?: string | null
          qty?: number
          planned_date?: string
          actual_date?: string | null
          status?: Database["app"]["Enums"]["inbound_status"]
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_snapshot: {
        Row: {
          id: number
          item_code: string
          snap_date: string
          qty: number
          stock_class: Database["app"]["Enums"]["stock_class"]
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          item_code?: string
          snap_date?: string
          qty?: number
          stock_class?: Database["app"]["Enums"]["stock_class"]
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          item_code?: string
          snap_date?: string
          qty?: number
          stock_class?: Database["app"]["Enums"]["stock_class"]
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      item_class: {
        Row: {
          key_code: string
          category: string | null
          pattern: string | null
          abc: string | null
          xyz: string | null
          adi: number | null
          cv2: number | null
          cv: number | null
          value_12m: number | null
          share: number | null
          champion_method: string | null
          run_id: string | null
          computed_at: string | null
        }
        Insert: {
          key_code?: string
          category?: string | null
          pattern?: string | null
          abc?: string | null
          xyz?: string | null
          adi?: number | null
          cv2?: number | null
          cv?: number | null
          value_12m?: number | null
          share?: number | null
          champion_method?: string | null
          run_id?: string | null
          computed_at?: string | null
        }
        Update: {
          key_code?: string
          category?: string | null
          pattern?: string | null
          abc?: string | null
          xyz?: string | null
          adi?: number | null
          cv2?: number | null
          cv?: number | null
          value_12m?: number | null
          share?: number | null
          champion_method?: string | null
          run_id?: string | null
          computed_at?: string | null
        }
        Relationships: []
      }
      item_setting: {
        Row: {
          item_code: string
          target_dos_days: number | null
          moq: number
          pack_unit: number | null
          min_order_amount: number | null
          unit_price: number | null
          currency: string | null
          allocation_mode: Database["app"]["Enums"]["allocation_mode"]
          status: Database["app"]["Enums"]["setting_status"]
          approved_by: string | null
          approved_at: string | null
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          item_code?: string
          target_dos_days?: number | null
          moq?: number
          pack_unit?: number | null
          min_order_amount?: number | null
          unit_price?: number | null
          currency?: string | null
          allocation_mode?: Database["app"]["Enums"]["allocation_mode"]
          status?: Database["app"]["Enums"]["setting_status"]
          approved_by?: string | null
          approved_at?: string | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          item_code?: string
          target_dos_days?: number | null
          moq?: number
          pack_unit?: number | null
          min_order_amount?: number | null
          unit_price?: number | null
          currency?: string | null
          allocation_mode?: Database["app"]["Enums"]["allocation_mode"]
          status?: Database["app"]["Enums"]["setting_status"]
          approved_by?: string | null
          approved_at?: string | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification: {
        Row: {
          id: number
          recipient: string
          channel: Database["app"]["Enums"]["notify_channel"]
          kind: string
          title: string
          body: string | null
          payload: Json | null
          created_at: string | null
          sent_at: string | null
          read_at: string | null
          result: string | null
        }
        Insert: {
          id?: number
          recipient?: string
          channel?: Database["app"]["Enums"]["notify_channel"]
          kind?: string
          title?: string
          body?: string | null
          payload?: Json | null
          created_at?: string | null
          sent_at?: string | null
          read_at?: string | null
          result?: string | null
        }
        Update: {
          id?: number
          recipient?: string
          channel?: Database["app"]["Enums"]["notify_channel"]
          kind?: string
          title?: string
          body?: string | null
          payload?: Json | null
          created_at?: string | null
          sent_at?: string | null
          read_at?: string | null
          result?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          email: string | null
          name: string | null
          role: Database["app"]["Enums"]["role"]
          dept: string | null
          created_at: string | null
        }
        Insert: {
          user_id?: string
          email?: string | null
          name?: string | null
          role?: Database["app"]["Enums"]["role"]
          dept?: string | null
          created_at?: string | null
        }
        Update: {
          user_id?: string
          email?: string | null
          name?: string | null
          role?: Database["app"]["Enums"]["role"]
          dept?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      shipment_extra: {
        Row: {
          item_code: string
          ym: string
          qty: number
          item_type: string
          source: string
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          item_code?: string
          ym?: string
          qty?: number
          item_type?: string
          source?: string
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          item_code?: string
          ym?: string
          qty?: number
          item_type?: string
          source?: string
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier: {
        Row: {
          id: number
          code: string
          name: string
          country: string | null
          prep_days: number
          lead_time_days: number
          sailing_rule: Json | null
          source: string
          is_dummy: boolean
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          code?: string
          name?: string
          country?: string | null
          prep_days?: number
          lead_time_days?: number
          sailing_rule?: Json | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          code?: string
          name?: string
          country?: string | null
          prep_days?: number
          lead_time_days?: number
          sailing_rule?: Json | null
          source?: string
          is_dummy?: boolean
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          value: Json
          description: string | null
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          key?: string
          value?: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          key?: string
          value?: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      upload_log: {
        Row: {
          id: string
          file_name: string | null
          target: string
          row_count: number
          ok_count: number
          error_count: number
          errors: Json
          status: string
          uploaded_by: string | null
          uploaded_at: string | null
        }
        Insert: {
          id?: string
          file_name?: string | null
          target?: string
          row_count?: number
          ok_count?: number
          error_count?: number
          errors?: Json
          status?: string
          uploaded_by?: string | null
          uploaded_at?: string | null
        }
        Update: {
          id?: string
          file_name?: string | null
          target?: string
          row_count?: number
          ok_count?: number
          error_count?: number
          errors?: Json
          status?: string
          uploaded_by?: string | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_available_stock: {
        Row: {
          item_code: string | null
          on_hand: number | null
          temp_allocated: number | null
          firm_allocated: number | null
          available: number | null
        }
        Relationships: []
      }
      v_item_setting: {
        Row: {
          item_code: string | null
          target_dos_days: number | null
          moq: number | null
          pack_unit: number | null
          min_order_amount: number | null
          unit_price: number | null
          currency: string | null
          allocation_mode: Database["app"]["Enums"]["allocation_mode"] | null
          status: Database["app"]["Enums"]["setting_status"] | null
          approved_by: string | null
          approved_at: string | null
          source: string | null
          is_dummy: boolean | null
          updated_by: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_my_approvals: {
        Row: {
          id: string | null
          kind: Database["app"]["Enums"]["approval_kind"] | null
          target_table: string | null
          target_pk: string | null
          payload: Json | null
          requested_by: string | null
          requested_at: string | null
          approver: string | null
          status: Database["app"]["Enums"]["approval_status"] | null
          reason: string | null
          comment: string | null
          decided_at: string | null
          requester_name: string | null
          approver_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_role: { Args: Record<string, never>; Returns: unknown }
      fn_apply_tuning: { Args: { p_approval: unknown; p_decision: string }; Returns: undefined }
      fn_apply_upload: { Args: { p_target: string; p_rows: Json; p_mode: string; p_file_name: string }; Returns: Json }
      fn_audit: { Args: Record<string, never>; Returns: unknown }
      fn_dashboard_summary: { Args: Record<string, never>; Returns: Json }
      fn_decide_approval: { Args: { p_id: string; p_decision: string; p_comment: string }; Returns: undefined }
      fn_mark_read: { Args: { p_ids: number[] }; Returns: undefined }
      fn_refresh_matviews: { Args: Record<string, never>; Returns: undefined }
      fn_request_approval: { Args: { p_kind: string; p_target_table: string; p_target_pk: string; p_payload: Json; p_reason: string }; Returns: string }
      fn_request_forecast_run: { Args: { p_run_type: string; p_eval_fy: number; p_horizon: number }; Returns: string }
      fn_request_tuning_approval: { Args: { p_proposal_id: string; p_reason: string }; Returns: string }
      fn_unread_count: { Args: Record<string, never>; Returns: number }
      handle_new_user: { Args: Record<string, never>; Returns: unknown }
      notify_role: { Args: { p_role: unknown; p_kind: string; p_title: string; p_body: string; p_payload: Json }; Returns: undefined }
      notify_user: { Args: { p_user: string; p_kind: string; p_title: string; p_body: string; p_payload: Json }; Returns: undefined }
    }
    Enums: {
      allocation_mode: "auto" | "manual"
      approval_kind: "item_setting" | "target_dos" | "allocation_mode" | "order_plan" | "priority_alloc" | "bulkdeal" | "forecast_tuning"
      approval_status: "pending" | "approved" | "rejected"
      inbound_status: "ordered" | "shipped" | "received"
      notify_channel: "system" | "email"
      role: "item_manager" | "scm_lead" | "sales" | "marketing" | "service" | "biz_enable" | "admin"
      run_status: "requested" | "running" | "done" | "failed"
      run_type: "backtest" | "production"
      setting_status: "draft" | "pending" | "approved"
      stock_class: "normal" | "inspection" | "defect" | "service_center" | "partner" | "in_transit"
    }
    CompositeTypes: Record<string, never>
  }
  analytics: {
    Tables: {
    }
    Views: {
      mv_item_stats: {
        Row: {
          key_code: string | null
          category: string | null
          description: string | null
          family: string | null
          avg_6m: number | null
          total_12m: number | null
          last_ship_ym: string | null
        }
        Relationships: []
      }
      v_abc_xyz_matrix: {
        Row: {
          abc: string | null
          xyz: string | null
          n_items: number | null
          value_12m: number | null
          value_share: number | null
        }
        Relationships: []
      }
      v_accuracy_summary: {
        Row: {
          id: number | null
          run_id: string | null
          level: string | null
          key: string | null
          method: string | null
          bias: number | null
          wape: number | null
          mape: number | null
          n: number | null
          sum_actual: number | null
          extra: Json | null
        }
        Relationships: []
      }
      v_bom_requirement: {
        Row: {
          model_base: string | null
          model_key: string | null
          part_role: string | null
          item_code: string | null
          description: string | null
          qty: number | null
          bom_group: string | null
        }
        Relationships: []
      }
      v_bom_requirement_x: {
        Row: {
          model_base: string | null
          model_key: string | null
          part_role: string | null
          item_code: string | null
          description: string | null
          qty: number | null
          bom_group: string | null
          n_models: number | null
          common_flag: string | null
          common_note: string | null
        }
        Relationships: []
      }
      v_forecast_latest: {
        Row: {
          key_code: string | null
          category: string | null
          ym: string | null
          method: string | null
          value: number | null
          lower: number | null
          upper: number | null
          run_id: string | null
        }
        Relationships: []
      }
      v_forecast_latest_run: {
        Row: {
          id: string | null
          run_type: Database["app"]["Enums"]["run_type"] | null
          eval_fy: number | null
          train_from: string | null
          train_to: string | null
          horizon: number | null
          summary: Json | null
          finished_at: string | null
        }
        Relationships: []
      }
      v_item_demand_kpi: {
        Row: {
          item_type: string | null
          n_items: number | null
          n_smooth: number | null
          n_erratic: number | null
          n_intermittent: number | null
          n_lumpy: number | null
          n_unknown: number | null
          n_croston_candidate: number | null
        }
        Relationships: []
      }
      v_item_demand_profile: {
        Row: {
          item_code: string | null
          description: string | null
          family: string | null
          item_type: string | null
          data_as_of: string | null
          first_ym: string | null
          last_ym: string | null
          n_periods: number | null
          n_nonzero: number | null
          mean_nonzero_qty: number | null
          adi: number | null
          zero_demand_rate: number | null
          cv_squared: number | null
          demand_type: string | null
          reason_code: string | null
        }
        Relationships: []
      }
      v_item_master: {
        Row: {
          key_code: string | null
          category: string | null
          description: string | null
          family: string | null
          avg_6m: number | null
          total_12m: number | null
          last_ship_ym: string | null
          target_dos_days: number | null
          moq: number | null
          allocation_mode: Database["app"]["Enums"]["allocation_mode"] | null
          setting_status: Database["app"]["Enums"]["setting_status"] | null
          setting_is_dummy: boolean | null
          on_hand: number | null
          snap_date: string | null
          stock_is_dummy: boolean | null
          inbound_qty: number | null
          dos_days: number | null
        }
        Relationships: []
      }
      v_item_monthly: {
        Row: {
          key_code: string | null
          category: string | null
          ym: string | null
          qty: number | null
        }
        Relationships: []
      }
      v_mc_compare: {
        Row: {
          model_base: string | null
          biz: string | null
          ym: string | null
          sales_ol: number | null
          scm_ol: number | null
          act: number | null
          system_fc: number | null
          method: string | null
          lower: number | null
          upper: number | null
          fy: number | null
        }
        Relationships: []
      }
      v_ol_accuracy: {
        Row: {
          model_base: string | null
          fy_sheet: string | null
          biz: string | null
          n_rows: number | null
          first_ym: string | null
          last_ym: string | null
          total_act: number | null
          n_scored_sales: number | null
          sales_wape: number | null
          sales_bias: number | null
          n_scored_scm: number | null
          scm_wape: number | null
          scm_bias: number | null
          reason_code: string | null
        }
        Relationships: []
      }
      v_ol_accuracy_fy: {
        Row: {
          fy_sheet: string | null
          n_rows: number | null
          n_scored: number | null
          sales_wape: number | null
          scm_wape: number | null
          sales_bias: number | null
          scm_bias: number | null
        }
        Relationships: []
      }
      v_part_linkage: {
        Row: {
          related_item: string | null
          related_desc: string | null
          hoc_item: string | null
          hoc_desc: string | null
          family: string | null
        }
        Relationships: []
      }
      v_realdata_kpi: {
        Row: {
          n_items: number | null
          n_models: number | null
          n_shipment_rows: number | null
          data_as_of: string | null
          data_from: string | null
          n_croston_candidate: number | null
          n_insufficient: number | null
          n_xcn_links: number | null
        }
        Relationships: []
      }
      v_shipment_trend: {
        Row: {
          item_code: string | null
          description: string | null
          family: string | null
          item_type: string | null
          data_as_of: string | null
          n_months: number | null
          first_ym: string | null
          last_ym: string | null
          months_since_last: number | null
          n_span: number | null
          total_qty: number | null
          latest_qty: number | null
          avg_3m: number | null
          avg_6m: number | null
          avg_12m: number | null
          trend_3m_vs_12m: number | null
          reason_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
    }
    Enums: {
    }
    CompositeTypes: Record<string, never>
  }
  core: {
    Tables: {
    }
    Views: {
      v_item: {
        Row: {
          item_code: string | null
          hoc_code: string | null
          description: string | null
          family: string | null
          item_type: string | null
          source_types: string | null
        }
        Relationships: []
      }
      v_model: {
        Row: {
          model_key: string | null
          model_base: string | null
          biz: string | null
          iot_code: string | null
          sources: string | null
        }
        Relationships: []
      }
      v_option_commonality: {
        Row: {
          item_code: string | null
          n_models: number | null
          common_flag: string | null
        }
        Relationships: []
      }
      v_option_model_link: {
        Row: {
          item_code: string | null
          model_base: string | null
          link_source: string | null
          is_sw: boolean | null
        }
        Relationships: []
      }
      v_part_linkage: {
        Row: {
          related_item: string | null
          hoc_item: string | null
        }
        Relationships: []
      }
      v_shipment_by_hoc: {
        Row: {
          hoc_item: string | null
          item_type: string | null
          ym: string | null
          qty: number | null
          n_source_codes: number | null
        }
        Relationships: []
      }
      v_ym_calendar: {
        Row: {
          ym: string | null
        }
        Relationships: []
      }
    }
    Functions: {
    }
    Enums: {
    }
    CompositeTypes: Record<string, never>
  }
}
