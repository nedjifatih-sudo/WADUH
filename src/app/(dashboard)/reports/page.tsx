"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Filter,
  Package,
  Boxes,
  QrCode,
  UserCheck,
  Wrench,
  ShieldAlert,
  History,
} from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exports";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

type ReportType =
  | "inventory_summary"
  | "stock_in"
  | "stock_out"
  | "low_stock"
  | "asset_register"
  | "asset_assignments"
  | "maintenance"
  | "warranty"
  | "audit_logs";

interface ReportConfig {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const REPORT_CATALOG: ReportConfig[] = [
  {
    id: "inventory_summary",
    title: "1. Consumable Inventory Summary",
    description: "Current on-hand warehouse quantities, unit costs, and total valuation.",
    icon: Boxes,
  },
  {
    id: "stock_in",
    title: "2. Stock Inbound Log Report",
    description: "Procurement arrivals, supplier deliveries, and stock increments.",
    icon: Package,
  },
  {
    id: "stock_out",
    title: "3. Stock Outbound Log Report",
    description: "Departmental requisitions, consumption, and item dispatches.",
    icon: History,
  },
  {
    id: "low_stock",
    title: "4. Low & Depleted Stock Warning Report",
    description: "Items currently below safety reorder threshold requiring procurement.",
    icon: History,
  },
  {
    id: "asset_register",
    title: "5. Fixed Asset Master Register",
    description: "Comprehensive registry of all serialized hardware and physical assets.",
    icon: QrCode,
  },
  {
    id: "asset_assignments",
    title: "6. Asset Custodianship & Issuance Report",
    description: "Active employee hardware allocations and returned device histories.",
    icon: UserCheck,
  },
  {
    id: "maintenance",
    title: "7. Asset Maintenance & Servicing Costs",
    description: "Hardware repairs, preventive checks, upgrades, and financial expenses.",
    icon: Wrench,
  },
  {
    id: "warranty",
    title: "8. Warranty Coverage & Expirations",
    description: "Manufacturer warranty timeline, active coverage, and expired devices.",
    icon: ShieldAlert,
  },
  {
    id: "audit_logs",
    title: "9. System Security & Audit Log Report",
    description: "System administrative actions, role permissions, and ledger audits.",
    icon: BarChart3,
  },
];

export default function ReportsPage() {
  const { currentOrg, profile } = useAuth();
  const supabase = createClient();

  const [selectedReport, setSelectedReport] = useState<ReportType>("inventory_summary");
  const [dateRange, setDateRange] = useState("all");

  // Query Data for Selected Report
  const { data: reportData = [], isLoading, refetch } = useQuery({
    queryKey: ["report-generator", currentOrg?.id, selectedReport, dateRange],
    queryFn: async () => {
      const orgId = currentOrg?.id;

      if (selectedReport === "inventory_summary") {
        let q = supabase
          .from("inventory")
          .select("quantity, updated_at, product:products(name, sku, unit, purchase_price, min_stock), warehouse:warehouses(name)");
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          "Product Name": row.product?.name || "-",
          SKU: row.product?.sku || "-",
          Warehouse: row.warehouse?.name || "-",
          Quantity: row.quantity || 0,
          Unit: row.product?.unit || "pcs",
          "Unit Price": formatCurrency(row.product?.purchase_price || 0),
          "Total Valuation": formatCurrency((row.product?.purchase_price || 0) * (row.quantity || 0)),
          "Min Safety Stock": row.product?.min_stock || 0,
        }));
      }

      if (selectedReport === "stock_in" || selectedReport === "stock_out") {
        const type = selectedReport === "stock_in" ? "in" : "out";
        let q = supabase
          .from("stock_movements")
          .select("created_at, type, quantity, balance_before, balance_after, reference_number, notes, product:products(name, sku), warehouse:warehouses(name), supplier:suppliers(name)")
          .eq("type", type)
          .order("created_at", { ascending: false });
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          Date: formatDateTime(row.created_at),
          Product: row.product?.name || "-",
          SKU: row.product?.sku || "-",
          Warehouse: row.warehouse?.name || "-",
          Quantity: row.quantity,
          "Balance Before": row.balance_before,
          "Balance After": row.balance_after,
          Supplier: row.supplier?.name || "-",
          "Reference No": row.reference_number || "-",
          Notes: row.notes || "-",
        }));
      }

      if (selectedReport === "low_stock") {
        let q = supabase
          .from("inventory")
          .select("quantity, product:products(name, sku, unit, min_stock), warehouse:warehouses(name)");
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        const low = (data || []).filter((r: any) => r.quantity <= (r.product?.min_stock || 0));
        return low.map((row: any) => ({
          Product: row.product?.name || "-",
          SKU: row.product?.sku || "-",
          Warehouse: row.warehouse?.name || "-",
          "Current Stock": row.quantity,
          "Min Safety Level": row.product?.min_stock || 0,
          Unit: row.product?.unit || "pcs",
          Deficit: Math.max(0, (row.product?.min_stock || 0) - row.quantity),
        }));
      }

      if (selectedReport === "asset_register") {
        let q = supabase
          .from("assets")
          .select("asset_tag, serial_number, condition, status, purchase_date, purchase_price, warranty_expiration, product:products(name, sku), warehouse:warehouses(name)");
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          "Asset Tag": row.asset_tag,
          "Serial Number": row.serial_number,
          Equipment: row.product?.name || "-",
          Condition: row.condition,
          Status: row.status,
          Location: row.warehouse?.name || "-",
          "Purchase Date": formatDate(row.purchase_date),
          "Purchase Cost": formatCurrency(row.purchase_price || 0),
          "Warranty Expiration": formatDate(row.warranty_expiration),
        }));
      }

      if (selectedReport === "asset_assignments") {
        let q = supabase
          .from("asset_assignments")
          .select("assigned_at, expected_return_date, returned_at, returned_condition, status, assignment_notes, asset:assets(asset_tag, serial_number, product:products(name)), employee:employees(full_name, employee_code, department)");
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          "Asset Tag": row.asset?.asset_tag || "-",
          Equipment: row.asset?.product?.name || "-",
          Custodian: row.employee?.full_name || "-",
          Department: row.employee?.department || "-",
          "Assigned Date": formatDate(row.assigned_at),
          "Expected Return": formatDate(row.expected_return_date),
          Status: row.status === "active" ? "In Possession" : "Returned",
          "Returned Date": formatDate(row.returned_at),
          "Return Condition": row.returned_condition || "-",
        }));
      }

      if (selectedReport === "maintenance") {
        let q = supabase
          .from("maintenance_records")
          .select("title, maintenance_type, cost, service_provider, start_date, completion_date, status, asset:assets(asset_tag, product:products(name))");
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          Task: row.title,
          "Asset Tag": row.asset?.asset_tag || "-",
          Equipment: row.asset?.product?.name || "-",
          Type: row.maintenance_type,
          Cost: formatCurrency(row.cost || 0),
          Provider: row.service_provider || "-",
          "Start Date": formatDate(row.start_date),
          "Completion Date": formatDate(row.completion_date),
          Status: row.status,
        }));
      }

      if (selectedReport === "warranty") {
        let q = supabase
          .from("assets")
          .select("asset_tag, serial_number, warranty_expiration, status, product:products(name), warehouse:warehouses(name)")
          .not("warranty_expiration", "is", null);
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          "Asset Tag": row.asset_tag,
          Equipment: row.product?.name || "-",
          "Serial Number": row.serial_number,
          "Warranty Expiration": formatDate(row.warranty_expiration),
          Location: row.warehouse?.name || "-",
          Status: row.status,
        }));
      }

      if (selectedReport === "audit_logs") {
        let q = supabase
          .from("audit_logs")
          .select("created_at, action, entity, user_id, user_agent")
          .order("created_at", { ascending: false });
        if (orgId) q = q.eq("organization_id", orgId);
        const { data } = await q;
        return (data || []).map((row: any) => ({
          Timestamp: formatDateTime(row.created_at),
          Action: row.action,
          Entity: row.entity,
          "User Agent": row.user_agent || "System",
        }));
      }

      return [];
    },
  });

  const activeReportConfig = REPORT_CATALOG.find((r) => r.id === selectedReport)!;

  const handleExportPDF = () => {
    if (!reportData.length) {
      toast.info("No data available to export");
      return;
    }
    const sample = reportData[0];
    const columns = Object.keys(sample).map((key) => ({
      header: key,
      dataKey: key,
    }));

    exportToPDF(
      {
        organizationName: currentOrg?.name || "INVENTORY OS",
        reportTitle: activeReportConfig.title,
        dateRange: "All Recorded Entries",
        generatedBy: profile?.full_name || "Authorized User",
      },
      columns,
      reportData
    );
    toast.success("PDF generated successfully");
  };

  const handleExportExcel = () => {
    if (!reportData.length) {
      toast.info("No data available to export");
      return;
    }
    exportToExcel(selectedReport, "Report", reportData);
    toast.success("Excel (.xlsx) exported successfully");
  };

  const handleExportCSV = () => {
    if (!reportData.length) {
      toast.info("No data available to export");
      return;
    }
    exportToCSV(selectedReport, reportData);
    toast.success("CSV file downloaded");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Enterprise Reporting & Export Center
        </h2>
        <p className="text-xs text-slate-500">
          Generate formatted PDF, Excel, and CSV executive reports with organization headers and audit seals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Report Selector Sidebar */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Available Reports
          </h3>
          <div className="space-y-1">
            {REPORT_CATALOG.map((r) => {
              const Icon = r.icon;
              const isSelected = selectedReport === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? "text-white" : "text-blue-600"}`} />
                  <div>
                    <div className="font-semibold">{r.title}</div>
                    <div className={`text-[10px] line-clamp-1 mt-0.5 ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                      {r.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Report Preview & Actions */}
        <div className="md:col-span-3 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-3">
              <div>
                <CardTitle className="text-base font-bold">{activeReportConfig.title}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{activeReportConfig.description}</CardDescription>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Excel (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 h-8"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPDF}
                  className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                  Official PDF
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {/* Report Preview Table */}
              <div className="border rounded-lg overflow-x-auto max-h-[500px]">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading dataset...</div>
                ) : reportData.length > 0 ? (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b uppercase text-[10px] text-slate-500 font-bold sticky top-0">
                      <tr>
                        {Object.keys(reportData[0]).map((header) => (
                          <th key={header} className="p-2.5 whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(row).map((val: any, cellIdx) => (
                            <td key={cellIdx} className="p-2.5 whitespace-nowrap text-slate-800">
                              {String(val ?? "-")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-xs text-slate-400">
                    No data records matching selected criteria.
                  </div>
                )}
              </div>
              <div className="mt-2 text-right text-[11px] text-slate-400">
                {reportData.length} records in dataset
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
