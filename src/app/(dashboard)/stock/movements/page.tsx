"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { StockMovementWithDetails } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, ArrowDownRight, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function StockMovementsPage() {
  const { currentOrg } = useAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const supabase = createClient();

  const { data: movements = [], isLoading } = useQuery<StockMovementWithDetails[]>({
    queryKey: ["stock-movements", currentOrg?.id, typeFilter],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("*, product:products(*), warehouse:warehouses(*), supplier:suppliers(*), creator:profiles(*)")
        .order("created_at", { ascending: false });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      if (typeFilter !== "all") q = q.eq("type", typeFilter as any);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const columns: ColumnDef<StockMovementWithDetails>[] = [
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-600">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
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
      accessorKey: "type",
      header: "Movement Type",
      cell: ({ row }) => {
        const t = row.original.type;
        if (t === "in") {
          return (
            <Badge variant="success" className="text-xs gap-1 font-semibold">
              <ArrowDownRight className="h-3 w-3" /> Stock In
            </Badge>
          );
        }
        if (t === "out") {
          return (
            <Badge variant="warning" className="text-xs gap-1 font-semibold">
              <ArrowUpRight className="h-3 w-3" /> Stock Out
            </Badge>
          );
        }
        if (t === "adjustment_in") {
          return (
            <Badge variant="info" className="text-xs gap-1 font-semibold">
              <SlidersHorizontal className="h-3 w-3" /> Adj (+)
            </Badge>
          );
        }
        return (
          <Badge variant="destructive" className="text-xs gap-1 font-semibold">
            <SlidersHorizontal className="h-3 w-3" /> Adj (-)
          </Badge>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: "Change Qty",
      cell: ({ row }) => {
        const isPositive = row.original.type === "in" || row.original.type === "adjustment_in";
        return (
          <span className={`font-bold text-xs ${isPositive ? "text-emerald-600" : "text-amber-600"}`}>
            {isPositive ? "+" : "-"}
            {row.original.quantity} {row.original.product?.unit}
          </span>
        );
      },
    },
    {
      id: "balance_tracking",
      header: "Balance (Before → After)",
      cell: ({ row }) => (
        <div className="text-xs font-mono text-slate-700">
          <span className="text-slate-400">{row.original.balance_before}</span>
          <span className="mx-1.5 text-slate-300">→</span>
          <span className="font-bold text-slate-900">{row.original.balance_after}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => (
        <span className="text-xs text-slate-700 font-medium">{row.original.warehouse?.name}</span>
      ),
    },
    {
      accessorKey: "reference_number",
      header: "Reference",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-600">
          {row.original.reference_number || "-"}
        </span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Ledger Notes",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 line-clamp-1 max-w-[200px]">
          {row.original.notes || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Stock Movements Ledger
          </h2>
          <p className="text-xs text-slate-500">
            Immutable transaction ledger recording every stock inbound, dispatch, and adjustment event.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="All Movement Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movements</SelectItem>
              <SelectItem value="in">Inbound (Stock In)</SelectItem>
              <SelectItem value="out">Outbound (Stock Out)</SelectItem>
              <SelectItem value="adjustment_in">Adjustment (+)</SelectItem>
              <SelectItem value="adjustment_out">Adjustment (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={movements}
        searchPlaceholder="Search movement, SKU, reference..."
        exportFilename="stock_movements_ledger"
        reportTitle="Immutable Stock Movement Transaction Ledger"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />
    </div>
  );
}
