"use client";

import React, { useState, useEffect } from "react";
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
import { ArrowUpFromLine, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { queueOfflineOperation } from "@/lib/offline/idb";

export default function StockOutPage() {
  const router = useRouter();
  const { currentOrg } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  // Fetch Products
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

  // Fetch Current Inventory Balance for selected product & warehouse
  useEffect(() => {
    async function checkBalance() {
      if (productId && warehouseId) {
        const { data } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("product_id", productId)
          .eq("warehouse_id", warehouseId)
          .maybeSingle();

        setAvailableStock(data ? data.quantity : 0);
      } else {
        setAvailableStock(null);
      }
    }
    checkBalance();
  }, [productId, warehouseId]);

  const stockOutMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!productId) throw new Error("Please select a product");
      if (!warehouseId) throw new Error("Please select a warehouse");
      if (!purpose.trim()) throw new Error("Purpose of issue is required");

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Quantity must be greater than zero");
      }

      if (availableStock !== null && qty > availableStock) {
        throw new Error(`Insufficient stock. Current available: ${availableStock}`);
      }

      const idempotencyKey = crypto.randomUUID();

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineOperation("stock_out", {
          organization_id: currentOrg.id,
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: qty,
          purpose: purpose.trim(),
          reference_number: referenceNumber.trim() || null,
          notes: notes.trim() || null,
        });
        return { offline: true };
      }

      const { data, error } = await (supabase.rpc as any)("process_stock_out", {
        p_org_id: currentOrg.id,
        p_product_id: productId,
        p_warehouse_id: warehouseId,
        p_quantity: qty,
        p_purpose: purpose.trim(),
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
        toast.info("Offline mode: Stock Out operation queued in outbox.");
      } else {
        toast.success(`Stock Out recorded! Remaining Balance: ${res.balance_after}`);
      }

      router.push("/inventory");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process stock out");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stockOutMutation.mutate();
  };

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-amber-600" />
            Stock Outbound (Dispatch & Consumption)
          </h2>
          <p className="text-xs text-slate-500">
            Deduct consumable items issued to departments, maintenance, or operations.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-base">Requisition Details</CardTitle>
            <CardDescription className="text-xs">
              Prevents stock from becoming negative through server-side PostgreSQL locks.
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
                <Label>Source Warehouse *</Label>
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
                <div className="flex items-center justify-between">
                  <Label>
                    Quantity {selectedProduct ? `(${selectedProduct.unit})` : ""} *
                  </Label>
                  {availableStock !== null && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Available: <span className="font-bold text-slate-900">{availableStock}</span>
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  min="1"
                  max={availableStock !== null ? availableStock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Purpose of Issue *</Label>
                <Input
                  placeholder="e.g. Design Dept Supplies or Client Prep"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Requisition / Ticket Reference</Label>
                <Input
                  placeholder="REQ-2024-001"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Disbursement Notes</Label>
              <Textarea
                placeholder="Requested by, approval details, special notes..."
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
              disabled={stockOutMutation.isPending || (availableStock !== null && availableStock <= 0)}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {stockOutMutation.isPending ? "Executing Transaction..." : "Confirm Stock Out"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
