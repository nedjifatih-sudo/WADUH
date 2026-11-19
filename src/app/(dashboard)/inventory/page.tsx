"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { InventoryWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Warehouse,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function StockOverviewPage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();

  const { data: inventory = [], isLoading } = useQuery<InventoryWithDetails[]>({
    queryKey: ["inventory-overview", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("inventory")
        .select("*, product:products(*), warehouse:warehouses(*)")
        .order("quantity", { ascending: true });
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const columns: ColumnDef<InventoryWithDetails>[] = [
    {
      accessorKey: "product.name",
      header: "Product / SKU",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{row.original.product?.name}</span>
          <span className="text-xs text-slate-500 font-mono">SKU: {row.original.product?.sku}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
          <Warehouse className="h-3.5 w-3.5 text-slate-400" />
          <span>{row.original.warehouse?.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "On-Hand Balance",
      cell: ({ row }) => {
        const qty = row.original.quantity;
        const minStock = row.original.product?.min_stock || 0;
        const isDepleted = qty === 0;
        const isLow = qty <= minStock;

        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isDepleted ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"}`}>
              {qty} {row.original.product?.unit}
            </span>
            {isDepleted ? (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                Depleted
              </Badge>
            ) : isLow ? (
              <Badge variant="warning" className="text-[10px] px-1 py-0">
                Low Stock
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px] px-1 py-0">
                Healthy
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "product.min_stock",
      header: "Safety Min",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.original.product?.min_stock || 0} {row.original.product?.unit}
        </span>
      ),
    },
    {
      accessorKey: "total_value",
      header: "Stock Valuation",
      cell: ({ row }) => {
        const cost = Number(row.original.product?.purchase_price || 0);
        const total = cost * (row.original.quantity || 0);
        return <span className="font-medium text-xs text-slate-800">{formatCurrency(total)}</span>;
      },
    },
    {
      accessorKey: "updated_at",
      header: "Last Movement",
      cell: ({ row }) => (
        <span className="text-xs text-slate-400">{formatDate(row.original.updated_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Inventory Balances</h2>
          <p className="text-xs text-slate-500">
            Real-time warehouse consumable stock balances calculated from atomic ledger entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can("stock:in") && (
            <Link href="/stock/in">
              <Button size="sm" className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
                <ArrowDownToLine className="h-4 w-4" />
                Stock In
              </Button>
            </Link>
          )}
          {can("stock:out") && (
            <Link href="/stock/out">
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
                <ArrowUpFromLine className="h-4 w-4" />
                Stock Out
              </Button>
            </Link>
          )}
          {can("stock:adjust") && (
            <Link href="/stock/adjustments">
              <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
                <SlidersHorizontal className="h-4 w-4" />
                Adjustment
              </Button>
            </Link>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={inventory}
        searchPlaceholder="Search product or warehouse..."
        exportFilename="inventory_balances"
        reportTitle="Warehouse Consumables Inventory Balance"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />
    </div>
  );
}
