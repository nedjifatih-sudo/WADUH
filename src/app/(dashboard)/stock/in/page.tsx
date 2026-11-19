"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownToLine, CheckCircle2, History, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { queueOfflineOperation } from "@/lib/offline/idb";

export default function StockInPage() {
  const router = useRouter();
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch Bulk Products
  const { data: products = [] } = useQuery({
    queryKey: ["bulk-products", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, sku, unit")
        .eq("tracking_mode", "bulk")
        .eq("status", "active")
        .order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Warehouses
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("warehouses").select("id, name, code").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("suppliers").select("id, name").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!productId) throw new Error("Please select a product");
      if (!warehouseId) throw new Error("Please select a target warehouse");

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Quantity must be greater than zero");
      }

      const idempotencyKey = crypto.randomUUID();

      // Check if online or offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Queue into offline outbox
        await queueOfflineOperation("stock_in", {
          organization_id: currentOrg.id,
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: qty,
          supplier_id: supplierId || null,
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });
        return { offline: true };
      }

      // Execute atomic PostgreSQL RPC
      const { data, error } = await (supabase.rpc as any)("process_stock_in", {
        p_org_id: currentOrg.id,
        p_product_id: productId,
        p_warehouse_id: warehouseId,
        p_quantity: qty,
        p_supplier_id: supplierId || null,
        p_reference_number: referenceNumber.trim() || null,
        p_notes: notes.trim() || null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-overview"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });

      if (res?.offline) {
        toast.info("Offline mode: Stock In operation queued in outbox and will sync when reconnected.");
      } else {
        toast.success(`Stock In recorded successfully! New Balance: ${res.balance_after}`);
      }

      router.push("/inventory");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process stock in");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stockInMutation.mutate();
  };

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
            Stock Inbound (Receiving)
          </h2>
          <p className="text-xs text-slate-500">
            Record newly received bulk consumables into warehouse inventory.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-base">Transaction Details</CardTitle>
            <CardDescription className="text-xs">
              Every inbound transaction updates balances atomically and writes to the immutable ledger.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bulk consumable product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Destination Warehouse *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs">
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Quantity {selectedProduct ? `(${selectedProduct.unit})` : ""} *
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier / Vendor (Optional)</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>PO / Invoice Reference Number</Label>
                <Input
                  placeholder="e.g. PO-2024-0988"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Receiving Notes</Label>
              <Textarea
                placeholder="Condition on receipt, delivery batch, shipment tracking..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/inventory")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={stockInMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {stockInMutation.isPending ? "Executing Transaction..." : "Confirm Stock In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
