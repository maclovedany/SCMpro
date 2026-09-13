// 자동 생성: engine gen-types — 수정 금지
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  app: {
    Tables: {
      ai_conversation: {
        Row: {
          id: string
          user_id: string
          title: string | null
          summary: string | null
          page_context: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          title?: string | null
          summary?: string | null
          page_context?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          summary?: string | null
          page_context?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_message: {
        Row: {
          id: number
          conversation_id: string
          role: string
          content: string | null
          tool_name: string | null
          tool_args: Json | null
          topic: string | null
          tokens_in: number | null
          tokens_out: number | null
          latency_ms: number | null
          error: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          conversation_id?: string
          role?: string
          content?: string | null
          tool_name?: string | null
          tool_args?: Json | null
          topic?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          latency_ms?: number | null
          error?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          conversation_id?: string
          role?: string
          content?: string | null
          tool_name?: string | null
          tool_args?: Json | null
          topic?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          latency_ms?: number | null
          error?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      allocation: {
        Row: {
          id: number
          order_id: string
          item_code: string
          qty: number
          kind: Database["app"]["Enums"]["alloc_kind"]
          created_at: string | null
          expires_at: string | null
          released_at: string | null
          release_reason: string | null
          approval_id: string | null
          created_by: string | null
        }
        Insert: {
          id?: number
          order_id?: string
          item_code?: string
          qty?: number
          kind?: Database["app"]["Enums"]["alloc_kind"]
          created_at?: string | null
          expires_at?: string | null
          released_at?: string | null
          release_reason?: string | null
          approval_id?: string | null
          created_by?: string | null
        }
        Update: {
          id?: number
          order_id?: string
          item_code?: string
          qty?: number
          kind?: Database["app"]["Enums"]["alloc_kind"]
          created_at?: string | null
          expires_at?: string | null
          released_at?: string | null
          release_reason?: string | null
          approval_id?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
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
      demand_submission: {
        Row: {
          id: number
          dept: Database["app"]["Enums"]["role"]
          ym: string
          submitted_by: string | null
          submitted_at: string | null
          note: string | null
        }
        Insert: {
          id?: number
          dept?: Database["app"]["Enums"]["role"]
          ym?: string
          submitted_by?: string | null
          submitted_at?: string | null
          note?: string | null
        }
        Update: {
          id?: number
          dept?: Database["app"]["Enums"]["role"]
          ym?: string
          submitted_by?: string | null
          submitted_at?: string | null
          note?: string | null
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
      extra_demand: {
        Row: {
          id: string
          kind: Database["app"]["Enums"]["extra_kind"]
          item_code: string
          need_ym: string
          qty: number
          order_no: string | null
          customer: string | null
          model_base: string | null
          reason: string | null
          status: Database["app"]["Enums"]["extra_status"]
          approval_id: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          kind?: Database["app"]["Enums"]["extra_kind"]
          item_code?: string
          need_ym?: string
          qty?: number
          order_no?: string | null
          customer?: string | null
          model_base?: string | null
          reason?: string | null
          status?: Database["app"]["Enums"]["extra_status"]
          approval_id?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          kind?: Database["app"]["Enums"]["extra_kind"]
          item_code?: string
          need_ym?: string
          qty?: number
          order_no?: string | null
          customer?: string | null
          model_base?: string | null
          reason?: string | null
          status?: Database["app"]["Enums"]["extra_status"]
          approval_id?: string | null
          created_by?: string | null
          created_at?: string | null
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
          supplier_id: number | null
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
          supplier_id?: number | null
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
          supplier_id?: number | null
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
      ol_submission: {
        Row: {
          id: number
          plan_id: string | null
          item_code: string
          target_ym: string
          qty: number
          submitted_at: string | null
        }
        Insert: {
          id?: number
          plan_id?: string | null
          item_code?: string
          target_ym?: string
          qty?: number
          submitted_at?: string | null
        }
        Update: {
          id?: number
          plan_id?: string | null
          item_code?: string
          target_ym?: string
          qty?: number
          submitted_at?: string | null
        }
        Relationships: []
      }
      order_plan: {
        Row: {
          id: string
          plan_ym: string
          status: Database["app"]["Enums"]["plan_status"]
          note: string | null
          summary: Json | null
          approval_id: string | null
          created_by: string | null
          created_at: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          approved_by: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          plan_ym?: string
          status?: Database["app"]["Enums"]["plan_status"]
          note?: string | null
          summary?: Json | null
          approval_id?: string | null
          created_by?: string | null
          created_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          plan_ym?: string
          status?: Database["app"]["Enums"]["plan_status"]
          note?: string | null
          summary?: Json | null
          approval_id?: string | null
          created_by?: string | null
          created_at?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
        }
        Relationships: []
      }
      order_plan_line: {
        Row: {
          id: number
          plan_id: string
          key_code: string
          category: string | null
          supplier_id: number | null
          need_ym: string
          lead_months: number | null
          forecast_need: number | null
          extras_need: number | null
          on_hand: number | null
          inbound_until_need: number | null
          start_need: number | null
          target_stock: number | null
          avg_6m: number | null
          target_dos_days: number | null
          required_qty: number | null
          flex_base: number | null
          flex_pct: number | null
          flex_min: number | null
          flex_max: number | null
          flex_hit: boolean | null
          chosen_qty: number | null
          moq: number | null
          final_qty: number | null
          override_qty: number | null
          override_reason: string | null
          override_by: string | null
          override_at: string | null
          end_after: number | null
          dos_after: number | null
          stockout_risk: boolean | null
          blocked: boolean | null
          unit_price: number | null
          amount: number | null
          rationale: Json | null
          projection: Json | null
        }
        Insert: {
          id?: number
          plan_id?: string
          key_code?: string
          category?: string | null
          supplier_id?: number | null
          need_ym?: string
          lead_months?: number | null
          forecast_need?: number | null
          extras_need?: number | null
          on_hand?: number | null
          inbound_until_need?: number | null
          start_need?: number | null
          target_stock?: number | null
          avg_6m?: number | null
          target_dos_days?: number | null
          required_qty?: number | null
          flex_base?: number | null
          flex_pct?: number | null
          flex_min?: number | null
          flex_max?: number | null
          flex_hit?: boolean | null
          chosen_qty?: number | null
          moq?: number | null
          final_qty?: number | null
          override_qty?: number | null
          override_reason?: string | null
          override_by?: string | null
          override_at?: string | null
          end_after?: number | null
          dos_after?: number | null
          stockout_risk?: boolean | null
          blocked?: boolean | null
          unit_price?: number | null
          amount?: number | null
          rationale?: Json | null
          projection?: Json | null
        }
        Update: {
          id?: number
          plan_id?: string
          key_code?: string
          category?: string | null
          supplier_id?: number | null
          need_ym?: string
          lead_months?: number | null
          forecast_need?: number | null
          extras_need?: number | null
          on_hand?: number | null
          inbound_until_need?: number | null
          start_need?: number | null
          target_stock?: number | null
          avg_6m?: number | null
          target_dos_days?: number | null
          required_qty?: number | null
          flex_base?: number | null
          flex_pct?: number | null
          flex_min?: number | null
          flex_max?: number | null
          flex_hit?: boolean | null
          chosen_qty?: number | null
          moq?: number | null
          final_qty?: number | null
          override_qty?: number | null
          override_reason?: string | null
          override_by?: string | null
          override_at?: string | null
          end_after?: number | null
          dos_after?: number | null
          stockout_risk?: boolean | null
          blocked?: boolean | null
          unit_price?: number | null
          amount?: number | null
          rationale?: Json | null
          projection?: Json | null
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
      sales_order: {
        Row: {
          id: string
          order_no: string
          item_code: string
          qty: number
          customer: string | null
          sales_rep: string
          status: Database["app"]["Enums"]["so_status"]
          alloc_mode: Database["app"]["Enums"]["alloc_mode_choice"]
          priority: number
          requested_at: string
          expires_at: string | null
          confirmed_at: string | null
          decided_at: string | null
          cancel_reason: string | null
          prev_order_id: string | null
          note: string | null
        }
        Insert: {
          id?: string
          order_no?: string
          item_code?: string
          qty?: number
          customer?: string | null
          sales_rep?: string
          status?: Database["app"]["Enums"]["so_status"]
          alloc_mode?: Database["app"]["Enums"]["alloc_mode_choice"]
          priority?: number
          requested_at?: string
          expires_at?: string | null
          confirmed_at?: string | null
          decided_at?: string | null
          cancel_reason?: string | null
          prev_order_id?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          order_no?: string
          item_code?: string
          qty?: number
          customer?: string | null
          sales_rep?: string
          status?: Database["app"]["Enums"]["so_status"]
          alloc_mode?: Database["app"]["Enums"]["alloc_mode_choice"]
          priority?: number
          requested_at?: string
          expires_at?: string | null
          confirmed_at?: string | null
          decided_at?: string | null
          cancel_reason?: string | null
          prev_order_id?: string | null
          note?: string | null
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
      v_allocation_queue: {
        Row: {
          id: string | null
          order_no: string | null
          item_code: string | null
          qty: number | null
          customer: string | null
          sales_rep: string | null
          status: Database["app"]["Enums"]["so_status"] | null
          alloc_mode: Database["app"]["Enums"]["alloc_mode_choice"] | null
          priority: number | null
          requested_at: string | null
          expires_at: string | null
          confirmed_at: string | null
          decided_at: string | null
          cancel_reason: string | null
          prev_order_id: string | null
          note: string | null
          sales_rep_name: string | null
          description: string | null
          temp_qty: number | null
          firm_qty: number | null
          hold_qty: number | null
          shortage: number | null
          available: number | null
          allocation_mode: Database["app"]["Enums"]["allocation_mode"] | null
          queue_pos: number | null
        }
        Relationships: []
      }
      v_available_stock: {
        Row: {
          item_code: string | null
          description: string | null
          category: string | null
          on_hand: number | null
          temp_allocated: number | null
          firm_allocated: number | null
          hold_qty: number | null
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
      v_sales_order: {
        Row: {
          id: string | null
          order_no: string | null
          item_code: string | null
          qty: number | null
          customer: string | null
          sales_rep: string | null
          status: Database["app"]["Enums"]["so_status"] | null
          alloc_mode: Database["app"]["Enums"]["alloc_mode_choice"] | null
          priority: number | null
          requested_at: string | null
          expires_at: string | null
          confirmed_at: string | null
          decided_at: string | null
          cancel_reason: string | null
          prev_order_id: string | null
          note: string | null
          sales_rep_name: string | null
          description: string | null
          temp_qty: number | null
          firm_qty: number | null
          hold_qty: number | null
          shortage: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_role: { Args: Record<string, never>; Returns: unknown }
      fn_add_extra_demand: { Args: { p_kind: string; p_item: string; p_need_ym: unknown; p_qty: unknown; p_order_no: string; p_customer: string; p_model: string; p_reason: string }; Returns: Json }
      fn_ai_stats: { Args: { p_days: number }; Returns: Json }
      fn_allocation_tick: { Args: Record<string, never>; Returns: Json }
      fn_append_plan_lines: { Args: { p_plan_id: string; p_lines: Json }; Returns: number }
      fn_apply_tuning: { Args: { p_approval: unknown; p_decision: string }; Returns: undefined }
      fn_apply_upload: { Args: { p_target: string; p_rows: Json; p_mode: string; p_file_name: string }; Returns: Json }
      fn_audit: { Args: Record<string, never>; Returns: unknown }
      fn_auto_allocate: { Args: { p_item: string }; Returns: number }
      fn_available_stock: { Args: { p_item: string }; Returns: unknown }
      fn_business_day: { Args: { d: unknown }; Returns: unknown }
      fn_cancel_sales_order: { Args: { p_id: string; p_reason: string }; Returns: undefined }
      fn_confirm_order_plan: { Args: { p_plan_id: string; p_reason: string }; Returns: string }
      fn_confirm_sales_order: { Args: { p_id: string }; Returns: undefined }
      fn_create_sales_order: { Args: { p_item: string; p_qty: unknown; p_customer: string; p_mode: string; p_prev: string }; Returns: Json }
      fn_dashboard_summary: { Args: Record<string, never>; Returns: Json }
      fn_decide_approval: { Args: { p_id: string; p_decision: string; p_comment: string }; Returns: undefined }
      fn_finalize_order_plan: { Args: { p_plan_id: string }; Returns: Json }
      fn_manual_allocate: { Args: { p_order: string; p_qty: unknown; p_reason: string }; Returns: Json }
      fn_mark_read: { Args: { p_ids: number[] }; Returns: undefined }
      fn_notification_email_copy: { Args: Record<string, never>; Returns: unknown }
      fn_order_calendar: { Args: { p_from: unknown; p_months: number }; Returns: unknown }
      fn_order_inputs: { Args: { p_plan_ym: unknown; p_category: string }; Returns: Json }
      fn_override_line: { Args: { p_line_id: unknown; p_qty: unknown; p_reason: string }; Returns: undefined }
      fn_plan_cat_projection: { Args: { p_plan_id: string }; Returns: Json }
      fn_receive_inbound: { Args: { p_inbound_id: unknown; p_actual: unknown }; Returns: Json }
      fn_refresh_matviews: { Args: Record<string, never>; Returns: undefined }
      fn_request_approval: { Args: { p_kind: string; p_target_table: string; p_target_pk: string; p_payload: Json; p_reason: string }; Returns: string }
      fn_request_forecast_run: { Args: { p_run_type: string; p_eval_fy: number; p_horizon: number }; Returns: string }
      fn_request_tuning_approval: { Args: { p_proposal_id: string; p_reason: string }; Returns: string }
      fn_sailing_dates: { Args: { p_rule: Json; p_ym: unknown }; Returns: unknown }
      fn_save_order_plan: { Args: { p_plan_ym: unknown; p_note: string; p_user: string }; Returns: string }
      fn_set_priority: { Args: { p_order: string; p_priority: number; p_reason: string }; Returns: undefined }
      fn_sidebar_badges: { Args: Record<string, never>; Returns: Json }
      fn_submission_deadline: { Args: { p_ym: unknown }; Returns: unknown }
      fn_submission_reminder_tick: { Args: Record<string, never>; Returns: number }
      fn_submission_status: { Args: { p_ym: unknown }; Returns: Json }
      fn_submit_demand: { Args: { p_ym: unknown; p_dept: string; p_note: string }; Returns: undefined }
      fn_tick: { Args: Record<string, never>; Returns: Json }
      fn_unread_count: { Args: Record<string, never>; Returns: number }
      handle_new_user: { Args: Record<string, never>; Returns: unknown }
      notify_order: { Args: { p_order: string; p_kind: string; p_title: string; p_body: string; p_payload: Json }; Returns: undefined }
      notify_role: { Args: { p_role: unknown; p_kind: string; p_title: string; p_body: string; p_payload: Json }; Returns: undefined }
      notify_user: { Args: { p_user: string; p_kind: string; p_title: string; p_body: string; p_payload: Json }; Returns: undefined }
    }
    Enums: {
      alloc_kind: "temp" | "firm" | "hold"
      alloc_mode_choice: "partial" | "wait"
      allocation_mode: "auto" | "manual"
      approval_kind: "item_setting" | "target_dos" | "allocation_mode" | "order_plan" | "priority_alloc" | "bulkdeal" | "forecast_tuning"
      approval_status: "pending" | "approved" | "rejected"
      extra_kind: "confirmed_order" | "meeting_approval" | "bulkdeal"
      extra_status: "pending" | "approved" | "rejected"
      inbound_status: "ordered" | "shipped" | "received"
      notify_channel: "system" | "email"
      plan_status: "draft" | "confirmed" | "approved" | "rejected"
      role: "item_manager" | "scm_lead" | "sales" | "marketing" | "service" | "biz_enable" | "admin"
      run_status: "requested" | "running" | "done" | "failed"
      run_type: "backtest" | "production"
      setting_status: "draft" | "pending" | "approved"
      so_status: "review_requested" | "partial" | "waiting" | "confirmed" | "rejected" | "cancelled" | "expired"
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
      v_ai_message_log: {
        Row: {
          id: number | null
          conversation_id: string | null
          user_id: string | null
          user_name: string | null
          user_role: Database["app"]["Enums"]["role"] | null
          role: string | null
          content: string | null
          topic: string | null
          tokens_in: number | null
          tokens_out: number | null
          latency_ms: number | null
          error: string | null
          created_at: string | null
          page_context: string | null
        }
        Relationships: []
      }
      v_ai_stats_daily: {
        Row: {
          day: string | null
          topic: string | null
          n: number | null
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
      v_inbound_gap: {
        Row: {
          id: number | null
          item_code: string | null
          supplier_id: number | null
          supplier_code: string | null
          supplier_name: string | null
          po_no: string | null
          qty: number | null
          planned_date: string | null
          actual_date: string | null
          diff_days: number | null
          ym: string | null
          item_type: string | null
        }
        Relationships: []
      }
      v_inbound_gap_summary: {
        Row: {
          supplier_code: string | null
          ym: string | null
          n: number | null
          avg_diff: number | null
          min_diff: number | null
          max_diff: number | null
          sd_diff: number | null
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
          pattern: string | null
          abc: string | null
          xyz: string | null
          champion_method: string | null
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
      v_order_plan_summary: {
        Row: {
          id: string | null
          plan_ym: string | null
          status: Database["app"]["Enums"]["plan_status"] | null
          created_at: string | null
          approved_at: string | null
          summary: Json | null
          n_lines: number | null
          amount: number | null
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
