"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { AssetWithDetails } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, ShieldCheck, AlertCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AssetWarrantyPage() {
  const { currentOrg } = useAuth();
  const [filter, setFilter] = useState("all");
  const supabase = createClient();

  const { data: assets = [], isLoading } = useQuery<AssetWithDetails[]>({
    queryKey: ["asset-warranties", currentOrg?.id, filter],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("*, product:products(*), warehouse:warehouses(*)")
        .not("warranty_expiration", "is", null)
        .order("warranty_expiration", { ascending: true });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);

      const { data, error } = await q;
      if (error) throw error;

      const now = new Date();
      const in30 = new Date();
      in30.setDate(now.getDate() + 30);
      const in90 = new Date();
      in90.setDate(now.getDate() + 90);

      const filtered = (data || []).filter((a) => {
        const exp = new Date(a.warranty_expiration!);
        if (filter === "expired") return exp < now;
        if (filter === "30d") return exp >= now && exp <= in30;
        if (filter === "90d") return exp >= now && exp <= in90;
        if (filter === "active") return exp > now;
        return true;
      });

      return filtered as any;
    },
  });

  const columns: ColumnDef<AssetWithDetails>[] = [
    {
      accessorKey: "asset_tag",
      header: "Asset Tag & Equipment",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 font-mono">
            {row.original.asset_tag}
          </span>
          <span className="text-xs text-slate-500">
            {row.original.product?.name} (S/N: {row.original.serial_number})
          </span>
        </div>
      ),
    },
    {
      accessorKey: "purchase_date",
      header: "Acquisition Date",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 font-mono">
          {formatDate(row.original.purchase_date)}
        </span>
      ),
    },
    {
      accessorKey: "warranty_expiration",
      header: "Warranty Expiration",
      cell: ({ row }) => (
        <span className="text-xs font-mono font-bold text-slate-900">
          {formatDate(row.original.warranty_expiration)}
        </span>
      ),
    },
    {
      id: "warranty_status",
      header: "Warranty Status",
      cell: ({ row }) => {
        if (!row.original.warranty_expiration) return "-";
        const exp = new Date(row.original.warranty_expiration);
        const now = new Date();
        const in30 = new Date();
        in30.setDate(now.getDate() + 30);
        const in90 = new Date();
        in90.setDate(now.getDate() + 90);

        if (exp < now) {
          return (
            <Badge variant="destructive" className="text-xs gap-1 font-semibold">
              <AlertCircle className="h-3 w-3" /> Expired
            </Badge>
          );
        }
        if (exp <= in30) {
          return (
            <Badge variant="warning" className="text-xs gap-1 font-semibold">
              <Clock className="h-3 w-3" /> Expires within 30 Days
            </Badge>
          );
        }
        if (exp <= in90) {
          return (
            <Badge variant="info" className="text-xs gap-1 font-semibold">
              <Clock className="h-3 w-3" /> Expires within 90 Days
            </Badge>
          );
        }
        return (
          <Badge variant="success" className="text-xs gap-1 font-semibold">
            <ShieldCheck className="h-3 w-3" /> Active Coverage
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Device Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize font-normal">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "warehouse.name",
      header: "Depot Location",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600">{row.original.warehouse?.name || "-"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            Asset Warranty Coverage & Expirations
          </h2>
          <p className="text-xs text-slate-500">
            Monitor manufacturer service warranties and schedule renewals before protection expires.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warranties</SelectItem>
              <SelectItem value="expired">Expired Warranties</SelectItem>
              <SelectItem value="30d">Expiring in 30 Days</SelectItem>
              <SelectItem value="90d">Expiring in 90 Days</SelectItem>
              <SelectItem value="active">Active Coverage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={assets}
        searchPlaceholder="Search asset tag, serial..."
        exportFilename="asset_warranty_report"
        reportTitle="Asset Warranty Coverage Report"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />
    </div>
  );
}
