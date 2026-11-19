export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "super_admin" | "admin" | "staff" | "manager" | "viewer";
export type TrackingMode = "bulk" | "serialized";
export type ProductStatus = "active" | "archived";
export type AssetCondition = "new" | "good" | "fair" | "poor" | "damaged";
export type AssetStatus = "available" | "assigned" | "maintenance" | "damaged" | "lost" | "disposed";
export type MaintenanceType = "preventive" | "corrective" | "inspection" | "upgrade";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type MovementType = "in" | "out" | "adjustment_in" | "adjustment_out";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          logo_url: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          code: string | null;
          address: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          code?: string | null;
          address?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          code?: string | null;
          address?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          warehouse_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          warehouse_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          warehouse_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
      };
      products: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string | null;
          name: string;
          sku: string;
          barcode: string | null;
          description: string | null;
          unit: string;
          tracking_mode: TrackingMode;
          purchase_price: number;
          selling_price: number;
          min_stock: number;
          image_url: string | null;
          status: ProductStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category_id?: string | null;
          name: string;
          sku: string;
          barcode?: string | null;
          description?: string | null;
          unit?: string;
          tracking_mode: TrackingMode;
          purchase_price?: number;
          selling_price?: number;
          min_stock?: number;
          image_url?: string | null;
          status?: ProductStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category_id?: string | null;
          name?: string;
          sku?: string;
          barcode?: string | null;
          description?: string | null;
          unit?: string;
          tracking_mode?: TrackingMode;
          purchase_price?: number;
          selling_price?: number;
          min_stock?: number;
          image_url?: string | null;
          status?: ProductStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      inventory: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          product_id?: string;
          warehouse_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          }
        ];
      };
      employees: {
        Row: {
          id: string;
          organization_id: string;
          employee_code: string;
          full_name: string;
          department: string;
          position: string;
          email: string | null;
          phone: string | null;
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_code: string;
          full_name: string;
          department: string;
          position: string;
          email?: string | null;
          phone?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_code?: string;
          full_name?: string;
          department?: string;
          position?: string;
          email?: string | null;
          phone?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          asset_tag: string;
          serial_number: string;
          barcode: string | null;
          warehouse_id: string | null;
          location_id: string | null;
          condition: AssetCondition;
          status: AssetStatus;
          purchase_date: string | null;
          purchase_price: number | null;
          warranty_expiration: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          asset_tag: string;
          serial_number: string;
          barcode?: string | null;
          warehouse_id?: string | null;
          location_id?: string | null;
          condition?: AssetCondition;
          status?: AssetStatus;
          purchase_date?: string | null;
          purchase_price?: number | null;
          warranty_expiration?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          product_id?: string;
          asset_tag?: string;
          serial_number?: string;
          barcode?: string | null;
          warehouse_id?: string | null;
          location_id?: string | null;
          condition?: AssetCondition;
          status?: AssetStatus;
          purchase_date?: string | null;
          purchase_price?: number | null;
          warranty_expiration?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          }
        ];
      };
      asset_assignments: {
        Row: {
          id: string;
          organization_id: string;
          asset_id: string;
          employee_id: string;
          assigned_by: string | null;
          assigned_at: string;
          expected_return_date: string | null;
          assignment_notes: string | null;
          returned_at: string | null;
          returned_condition: AssetCondition | null;
          returned_notes: string | null;
          status: "active" | "returned";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          asset_id: string;
          employee_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
          expected_return_date?: string | null;
          assignment_notes?: string | null;
          returned_at?: string | null;
          returned_condition?: AssetCondition | null;
          returned_notes?: string | null;
          status?: "active" | "returned";
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          asset_id?: string;
          employee_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
          expected_return_date?: string | null;
          assignment_notes?: string | null;
          returned_at?: string | null;
          returned_condition?: AssetCondition | null;
          returned_notes?: string | null;
          status?: "active" | "returned";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          }
        ];
      };
      maintenance_records: {
        Row: {
          id: string;
          organization_id: string;
          asset_id: string;
          title: string;
          description: string | null;
          maintenance_type: MaintenanceType;
          cost: number;
          service_provider: string | null;
          start_date: string;
          completion_date: string | null;
          status: MaintenanceStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          asset_id: string;
          title: string;
          description?: string | null;
          maintenance_type: MaintenanceType;
          cost?: number;
          service_provider?: string | null;
          start_date: string;
          completion_date?: string | null;
          status?: MaintenanceStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          asset_id?: string;
          title?: string;
          description?: string | null;
          maintenance_type?: MaintenanceType;
          cost?: number;
          service_provider?: string | null;
          start_date?: string;
          completion_date?: string | null;
          status?: MaintenanceStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_records_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          }
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          type: MovementType;
          quantity: number;
          balance_before: number;
          balance_after: number;
          supplier_id: string | null;
          reference_number: string | null;
          notes: string | null;
          idempotency_key: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          product_id: string;
          warehouse_id: string;
          type: MovementType;
          quantity: number;
          balance_before: number;
          balance_after: number;
          supplier_id?: string | null;
          reference_number?: string | null;
          notes?: string | null;
          idempotency_key?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          product_id?: string;
          warehouse_id?: string;
          type?: MovementType;
          quantity?: number;
          balance_before?: number;
          balance_after?: number;
          supplier_id?: string | null;
          reference_number?: string | null;
          notes?: string | null;
          idempotency_key?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          user_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          user_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      process_stock_in: {
        Args: {
          p_org_id: string;
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
          p_supplier_id?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      process_stock_out: {
        Args: {
          p_org_id: string;
          p_product_id: string;
          p_warehouse_id: string;
          p_quantity: number;
          p_purpose?: string | null;
          p_reference_number?: string | null;
          p_notes?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      process_stock_adjustment: {
        Args: {
          p_org_id: string;
          p_product_id: string;
          p_warehouse_id: string;
          p_direction: "in" | "out";
          p_quantity: number;
          p_reason: string;
          p_reference_number?: string | null;
          p_idempotency_key?: string | null;
        };
        Returns: Json;
      };
      process_asset_assignment: {
        Args: {
          p_org_id: string;
          p_asset_id: string;
          p_employee_id: string;
          p_assigned_at?: string | null;
          p_expected_return_date?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      process_asset_return: {
        Args: {
          p_org_id: string;
          p_asset_id: string;
          p_returned_condition: AssetCondition;
          p_returned_notes?: string | null;
          p_returned_at?: string | null;
        };
        Returns: Json;
      };
      process_asset_status_change: {
        Args: {
          p_org_id: string;
          p_asset_id: string;
          p_new_status: AssetStatus;
          p_notes?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
