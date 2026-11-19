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
import { SlidersHorizontal, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { queueOfflineOperation } from "@/lib/offline/idb";

export default function StockAdjustmentsPage() {
  const router = useRouter();
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

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

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("warehouses").select("id, name, code").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!productId) throw new Error("Please select a product");
      if (!warehouseId) throw new Error("Please select a warehouse");
      if (!reason.trim() || reason.trim().length < 5) {
        throw new Error("A mandatory adjustment reason (min 5 characters) must be stated");
      }

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Quantity must be greater than zero");
      }

      const idempotencyKey = crypto.randomUUID();

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineOperation("stock_adjustment", {
          organization_id: currentOrg.id,
          product_id: productId,
          warehouse_id: warehouseId,
          direction,
          quantity: qty,
          reason: reason.trim(),
          reference_number: referenceNumber.trim() || null,
        });
        return { offline: true };
      }

      const { data, error } = await (supabase.rpc as any)("process_stock_adjustment", {
        p_org_id: currentOrg.id,
        p_product_id: productId,
        p_warehouse_id: warehouseId,
        p_direction: direction,
        p_quantity: qty,
        p_reason: reason.trim(),
        p_reference_number: referenceNumber.trim() || null,
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
        toast.info("Offline mode: Stock adjustment queued in outbox.");
      } else {
        toast.success(`Adjustment recorded! New Balance: ${res.balance_after}`);
      }

      router.push("/inventory");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process adjustment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate();
  };

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-indigo-600" />
            Stock Inventory Adjustment
          </h2>
          <p className="text-xs text-slate-500">
            Reconcile physical stock audit counts, damage write-offs, or initial stock take corrections.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-base">Adjustment Parameters</CardTitle>
            <CardDescription className="text-xs">
              Every adjustment requires a mandatory business justification logged in the immutable audit trail.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select consumable product" />
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
                <Label>Warehouse *</Label>
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
                <Label>Adjustment Direction *</Label>
                <Select value={direction} onValueChange={(val: any) => setDirection(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in" className="text-xs">
                      + Positive Adjustment (Found Stock / Stock Take Surplus)
                    </SelectItem>
                    <SelectItem value="out" className="text-xs">
                      - Negative Adjustment (Shrinkage / Damage / Expired)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="space-y-1.5">
                <Label>Audit Reference / Count Tag</Label>
                <Input
                  placeholder="ADJ-AUDIT-2024"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mandatory Reason / Justification *</Label>
              <Textarea
                placeholder="Physical stock count discrepancy, water damage in storage aisle 2, audit reconciliation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="text-xs min-h-[80px]"
              />
              <span className="text-[10px] text-slate-400">
                Minimum 5 characters explaining reason for ledger balance correction.
              </span>
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
              disabled={adjustmentMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {adjustmentMutation.isPending ? "Recording Adjustment..." : "Authorize Adjustment"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
