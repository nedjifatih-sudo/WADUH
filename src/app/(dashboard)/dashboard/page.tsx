"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package,
  Boxes,
  QrCode,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cacheProducts, cacheAssets } from "@/lib/offline/idb";

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

export default function DashboardPage() {
  const { currentOrg } = useAuth();
  const [dateFilter, setDateFilter] = useState("30d");
  const supabase = createClient();

  // Fetch Dashboard Analytics
  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ["dashboard-metrics", currentOrg?.id, dateFilter],
    queryFn: async () => {
      const orgId = currentOrg?.id;

      // 1. Products
      let prodQuery = supabase.from("products").select("id, name, sku, purchase_price, min_stock, tracking_mode, status, category_id, category:categories(name)");
      if (orgId) prodQuery = prodQuery.eq("organization_id", orgId);
      const { data: products } = await prodQuery;
      const allProducts = products || [];

      // Cache products for offline access
      if (typeof window !== "undefined" && allProducts.length > 0) {
        cacheProducts(allProducts);
      }

      // 2. Inventory Balances
      let invQuery = supabase.from("inventory").select("id, product_id, warehouse_id, quantity");
      if (orgId) invQuery = invQuery.eq("organization_id", orgId);
      const { data: inventories } = await invQuery;
      const allInventories = inventories || [];

      // 3. Fixed Assets
      let assetQuery = supabase.from("assets").select("id, asset_tag, serial_number, condition, status, warranty_expiration, purchase_price, product:products(name)");
      if (orgId) assetQuery = assetQuery.eq("organization_id", orgId);
      const { data: assets } = await assetQuery;
      const allAssets = assets || [];

      if (typeof window !== "undefined" && allAssets.length > 0) {
        cacheAssets(allAssets);
      }

      // 4. Stock Movements
      let movQuery = supabase
        .from("stock_movements")
        .select("id, type, quantity, created_at, reference_number, product:products(name), warehouse:warehouses(name)")
        .order("created_at", { ascending: false });
      if (orgId) movQuery = movQuery.eq("organization_id", orgId);
      const { data: movements } = await movQuery.limit(50);
      const allMovements = movements || [];

      // 5. Recent Assignments
      let assignQuery = supabase
        .from("asset_assignments")
        .select("id, assigned_at, expected_return_date, status, employee:employees(full_name, department), asset:assets(asset_tag, product:products(name))")
        .eq("status", "active")
        .order("assigned_at", { ascending: false });
      if (orgId) assignQuery = assignQuery.eq("organization_id", orgId);
      const { data: assignments } = await assignQuery.limit(5);

      // Calculations
      const totalProducts = allProducts.length;
      const totalInventoryQty = allInventories.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const totalFixedAssets = allAssets.length;
      const assignedAssets = allAssets.filter((a) => a.status === "assigned").length;
      const availableAssets = allAssets.filter((a) => a.status === "available").length;

      // Product quantities mapped
      const productQtyMap = new Map<string, number>();
      allInventories.forEach((inv) => {
        productQtyMap.set(inv.product_id, (productQtyMap.get(inv.product_id) || 0) + inv.quantity);
      });

      // Low stock & out of stock
      const lowStockItems: any[] = [];
      let outOfStockCount = 0;
      let totalInventoryValue = 0;

      allProducts.forEach((p) => {
        if (p.tracking_mode === "bulk") {
          const qty = productQtyMap.get(p.id) || 0;
          totalInventoryValue += qty * Number(p.purchase_price || 0);

          if (qty === 0) {
            outOfStockCount++;
          }
          if (qty <= (p.min_stock || 0)) {
            lowStockItems.push({ ...p, current_stock: qty });
          }
        }
      });

      // Fixed assets value
      allAssets.forEach((a) => {
        totalInventoryValue += Number(a.purchase_price || 0);
      });

      // Monthly Stock In vs Out (Group by Month)
      const monthlyInOutMap = new Map<string, { stockIn: number; stockOut: number }>();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentYear = new Date().getFullYear();

      months.forEach((m) => {
        monthlyInOutMap.set(m, { stockIn: 0, stockOut: 0 });
      });

      allMovements.forEach((mov) => {
        const d = new Date(mov.created_at);
        if (d.getFullYear() === currentYear) {
          const m = months[d.getMonth()];
          const entry = monthlyInOutMap.get(m) || { stockIn: 0, stockOut: 0 };
          if (mov.type === "in" || mov.type === "adjustment_in") {
            entry.stockIn += mov.quantity;
          } else if (mov.type === "out" || mov.type === "adjustment_out") {
            entry.stockOut += mov.quantity;
          }
          monthlyInOutMap.set(m, entry);
        }
      });

      const monthlyChartData = Array.from(monthlyInOutMap.entries()).map(([month, data]) => ({
        month,
        stockIn: data.stockIn,
        stockOut: data.stockOut,
      }));

      // Category breakdown
      const catMap = new Map<string, number>();
      allProducts.forEach((p: any) => {
        const catName = p.category?.name || "Uncategorized";
        catMap.set(catName, (catMap.get(catName) || 0) + 1);
      });
      const categoryDistribution = Array.from(catMap.entries()).map(([name, value]) => ({
        name,
        value,
      }));

      // Asset Status breakdown
      const statusMap = new Map<string, number>();
      allAssets.forEach((a) => {
        const s = a.status.charAt(0).toUpperCase() + a.status.slice(1);
        statusMap.set(s, (statusMap.get(s) || 0) + 1);
      });
      const assetStatusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      // Upcoming warranty expirations (next 90 days)
      const now = new Date();
      const in90Days = new Date();
      in90Days.setDate(now.getDate() + 90);

      const upcomingWarranty = allAssets.filter((a) => {
        if (!a.warranty_expiration) return false;
        const exp = new Date(a.warranty_expiration);
        return exp >= now && exp <= in90Days;
      });

      return {
        totalProducts,
        totalInventoryQty,
        totalFixedAssets,
        assignedAssets,
        availableAssets,
        lowStockCount: lowStockItems.length,
        outOfStockCount,
        totalInventoryValue,
        monthlyChartData,
        categoryDistribution,
        assetStatusDistribution,
        lowStockItems: lowStockItems.slice(0, 5),
        recentMovements: allMovements.slice(0, 5),
        upcomingWarranty: upcomingWarranty.slice(0, 5),
        recentAssignments: assignments || [],
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Operational Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time telemetry and ledger metrics for consumable stock and enterprise assets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-9 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Total Products */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Products</span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {metrics?.totalProducts ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Catalog items</p>
        </Card>

        {/* Total Bulk Quantity */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Inventory Qty</span>
            <Boxes className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {metrics?.totalInventoryQty ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Bulk units in stock</p>
        </Card>

        {/* Total Fixed Assets */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Fixed Assets</span>
            <QrCode className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {metrics?.totalFixedAssets ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Serialized units</p>
        </Card>

        {/* Assigned Assets */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Assigned</span>
            <UserCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600">
            {metrics?.assignedAssets ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active deployments</p>
        </Card>

        {/* Available Assets */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Available</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">
            {metrics?.availableAssets ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ready to assign</p>
        </Card>

        {/* Low Stock Items */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Low Stock</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-500">
            {metrics?.lowStockCount ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Below minimum</p>
        </Card>

        {/* Out of Stock */}
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Out of Stock</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600">
            {metrics?.outOfStockCount ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Depleted stock</p>
        </Card>
      </div>

      {/* Financial Valuation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-md gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-300">Total Enterprise Asset Valuation</div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-0.5">
              {formatCurrency(metrics?.totalInventoryValue ?? 0)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/reports">
            <Button size="sm" variant="secondary" className="text-xs font-semibold gap-1.5 bg-white text-slate-900 hover:bg-slate-100">
              Generate Valuation Report
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock In vs Stock Out Bar Chart */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Stock In vs. Stock Out Activity</span>
              <span className="text-xs font-normal text-slate-500">Year to Date</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Comparison of warehouse inbound supplies and outbound allocations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.monthlyChartData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1E293B", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="stockIn" name="Stock In" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stockOut" name="Stock Out" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution Donut */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold">Catalog Categories</CardTitle>
            <CardDescription className="text-xs">
              Distribution of items across configured categories.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full flex items-center justify-center">
              {metrics?.categoryDistribution?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {metrics.categoryDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1E293B", color: "#FFF", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-slate-400">No categories registered yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Highlights & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock Threshold Alerts
              </CardTitle>
              <Link href="/stock/in">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                  Restock
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.lowStockItems?.length ? (
              metrics.lowStockItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div>
                    <div className="font-semibold text-xs text-slate-800 line-clamp-1">{item.name}</div>
                    <div className="text-[10px] text-slate-500">SKU: {item.sku}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-700">{item.current_stock}</span>
                    <span className="text-[10px] text-slate-500"> / min {item.min_stock}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                All inventory quantities are above safety thresholds.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Warranty Expiration */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                Upcoming Warranty Expirations
              </CardTitle>
              <Link href="/warranty">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.upcomingWarranty?.length ? (
              metrics.upcomingWarranty.map((asset: any) => (
                <div key={asset.id} className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/70 border border-rose-100">
                  <div>
                    <div className="font-semibold text-xs text-slate-800 line-clamp-1">{asset.product?.name}</div>
                    <div className="text-[10px] text-slate-500">Tag: {asset.asset_tag}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-rose-700">{formatDate(asset.warranty_expiration)}</div>
                    <span className="text-[10px] text-slate-500">Expires soon</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No warranties expiring within the next 90 days.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Asset Deployments */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Recent Asset Deployments
              </CardTitle>
              <Link href="/assignments">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.recentAssignments?.length ? (
              metrics.recentAssignments.map((assign: any) => (
                <div key={assign.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border">
                  <div>
                    <div className="font-semibold text-xs text-slate-800 line-clamp-1">{assign.asset?.product?.name}</div>
                    <div className="text-[10px] text-slate-500">Assigned to: {assign.employee?.full_name}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-[10px] bg-white">
                      {formatDate(assign.assigned_at)}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No active asset assignments recorded.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Stock Movements Ledger Preview */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Recent Stock Movements</CardTitle>
            <CardDescription className="text-xs">
              Live immutable ledger feed of stock inbound and outbound events.
            </CardDescription>
          </div>
          <Link href="/stock/movements">
            <Button variant="outline" size="sm" className="text-xs">
              Full Ledger
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {metrics?.recentMovements?.length ? (
              metrics.recentMovements.map((mov: any) => (
                <div key={mov.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${mov.type === "in" || mov.type === "adjustment_in" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {mov.type === "in" || mov.type === "adjustment_in" ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{mov.product?.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {mov.warehouse?.name} • Ref: {mov.reference_number || "Direct"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold ${mov.type === "in" || mov.type === "adjustment_in" ? "text-emerald-600" : "text-amber-600"}`}>
                      {mov.type === "in" || mov.type === "adjustment_in" ? "+" : "-"}
                      {mov.quantity}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatDate(mov.created_at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No inventory movements recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
