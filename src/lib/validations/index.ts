import { z } from "zod";

// Product Validation Schema
export const productSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(200),
  sku: z.string().min(2, "SKU must be at least 2 characters").max(50),
  barcode: z.string().optional().nullable(),
  category_id: z.string().uuid("Please select a valid category").optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  unit: z.string().min(1, "Unit is required").default("pcs"),
  tracking_mode: z.enum(["bulk", "serialized"]),
  purchase_price: z.coerce.number().min(0, "Purchase price cannot be negative"),
  selling_price: z.coerce.number().min(0, "Selling price cannot be negative"),
  min_stock: z.coerce.number().int().min(0, "Minimum stock cannot be negative"),
  image_url: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  status: z.enum(["active", "archived"]).default("active"),
});

export type ProductFormValues = z.infer<typeof productSchema>;

// Stock In Schema
export const stockInSchema = z.object({
  product_id: z.string().uuid("Please select a product"),
  warehouse_id: z.string().uuid("Please select a warehouse"),
  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),
  supplier_id: z.string().uuid("Invalid supplier").optional().nullable().or(z.literal("")),
  reference_number: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type StockInFormValues = z.infer<typeof stockInSchema>;

// Stock Out Schema
export const stockOutSchema = z.object({
  product_id: z.string().uuid("Please select a product"),
  warehouse_id: z.string().uuid("Please select a warehouse"),
  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),
  purpose: z.string().min(2, "Purpose is required (e.g., Office Consumables, Project A)"),
  reference_number: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type StockOutFormValues = z.infer<typeof stockOutSchema>;

// Stock Adjustment Schema
export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid("Please select a product"),
  warehouse_id: z.string().uuid("Please select a warehouse"),
  direction: z.enum(["in", "out"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be greater than 0"),
  reason: z.string().min(5, "Adjustment reason is mandatory (minimum 5 characters)"),
  reference_number: z.string().optional().nullable(),
});

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>;

// Asset Registration Schema
export const assetSchema = z.object({
  product_id: z.string().uuid("Please select a product"),
  asset_tag: z.string().min(2, "Asset Tag is required"),
  serial_number: z.string().min(2, "Serial Number is required"),
  barcode: z.string().optional().nullable(),
  warehouse_id: z.string().uuid("Invalid warehouse").optional().nullable().or(z.literal("")),
  location_id: z.string().uuid("Invalid location").optional().nullable().or(z.literal("")),
  condition: z.enum(["new", "good", "fair", "poor", "damaged"]).default("good"),
  status: z.enum(["available", "assigned", "maintenance", "damaged", "lost", "disposed"]).default("available"),
  purchase_date: z.string().optional().nullable(),
  purchase_price: z.coerce.number().min(0, "Price cannot be negative").default(0),
  warranty_expiration: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type AssetFormValues = z.infer<typeof assetSchema>;

// Asset Assignment Schema
export const assetAssignmentSchema = z.object({
  asset_id: z.string().uuid("Please select an asset"),
  employee_id: z.string().uuid("Please select an employee"),
  assigned_at: z.string().default(() => new Date().toISOString()),
  expected_return_date: z.string().optional().nullable(),
  assignment_notes: z.string().max(500).optional().nullable(),
});

export type AssetAssignmentFormValues = z.infer<typeof assetAssignmentSchema>;

// Asset Return Schema
export const assetReturnSchema = z.object({
  asset_id: z.string().uuid("Please select an asset"),
  returned_condition: z.enum(["new", "good", "fair", "poor", "damaged"]),
  returned_notes: z.string().max(500).optional().nullable(),
  returned_at: z.string().default(() => new Date().toISOString()),
});

export type AssetReturnFormValues = z.infer<typeof assetReturnSchema>;

// Maintenance Record Schema
export const maintenanceSchema = z.object({
  asset_id: z.string().uuid("Please select an asset"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional().nullable(),
  maintenance_type: z.enum(["preventive", "corrective", "inspection", "upgrade"]),
  cost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
  service_provider: z.string().optional().nullable(),
  start_date: z.string().min(1, "Start date is required"),
  completion_date: z.string().optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("in_progress"),
  notes: z.string().max(500).optional().nullable(),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

// Employee Schema
export const employeeSchema = z.object({
  employee_code: z.string().min(2, "Employee Code is required"),
  full_name: z.string().min(2, "Full Name is required"),
  department: z.string().min(2, "Department is required"),
  position: z.string().min(2, "Position is required"),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

// Supplier Schema
export const supplierSchema = z.object({
  name: z.string().min(2, "Supplier name is required"),
  contact_person: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

// Warehouse Schema
export const warehouseSchema = z.object({
  name: z.string().min(2, "Warehouse name is required"),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

// Location Schema
export const locationSchema = z.object({
  warehouse_id: z.string().uuid("Please select a warehouse"),
  name: z.string().min(2, "Location/Room name is required"),
  description: z.string().optional().nullable(),
});

export type LocationFormValues = z.infer<typeof locationSchema>;

// Category Schema
export const categorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  description: z.string().optional().nullable(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
