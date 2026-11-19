import { Database } from "./database";

export * from "./database";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type OrganizationMember = Database["public"]["Tables"]["organization_members"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Warehouse = Database["public"]["Tables"]["warehouses"]["Row"];
export type Location = Database["public"]["Tables"]["locations"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Inventory = Database["public"]["Tables"]["inventory"]["Row"];
export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type AssetAssignment = Database["public"]["Tables"]["asset_assignments"]["Row"];
export type MaintenanceRecord = Database["public"]["Tables"]["maintenance_records"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export interface ProductWithDetails extends Product {
  category?: Category | null;
  total_stock?: number;
  assets_count?: number;
}

export interface InventoryWithDetails extends Inventory {
  product: Product;
  warehouse: Warehouse;
}

export interface AssetWithDetails extends Asset {
  product: Product;
  warehouse?: Warehouse | null;
  location?: Location | null;
  current_assignment?: (AssetAssignment & { employee: Employee }) | null;
}

export interface StockMovementWithDetails extends StockMovement {
  product: Product;
  warehouse: Warehouse;
  supplier?: Supplier | null;
  creator?: Profile | null;
}

export interface AssetAssignmentWithDetails extends AssetAssignment {
  asset: Asset & { product: Product };
  employee: Employee;
  assigner?: Profile | null;
}

export interface MaintenanceRecordWithDetails extends MaintenanceRecord {
  asset: Asset & { product: Product };
}

export interface DashboardMetrics {
  totalProducts: number;
  totalInventoryQty: number;
  totalFixedAssets: number;
  assignedAssets: number;
  availableAssets: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
  monthlyStockInOut: Array<{
    month: string;
    stockIn: number;
    stockOut: number;
  }>;
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  assetStatusDistribution: Array<{
    status: string;
    count: number;
  }>;
  recentMovements: StockMovementWithDetails[];
  lowStockItems: (Product & { current_stock: number })[];
  upcomingWarranty: AssetWithDetails[];
  recentAssignments: AssetAssignmentWithDetails[];
}
