"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Product, ProductWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { BarcodeModal } from "@/components/barcode/barcode-modal";
import { generateAutoSKU } from "@/lib/barcode/generator";
import {
  Plus,
  QrCode,
  Edit,
  Archive,
  RotateCcw,
  Sparkles,
  Upload,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ProductsPage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeModalItem, setBarcodeModalItem] = useState<Product | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [trackingMode, setTrackingMode] = useState<"bulk" | "serialized">("bulk");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [minStock, setMinStock] = useState("5");
  const [status, setStatus] = useState<"active" | "archived">("active");

  // Fetch Categories for Dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("categories").select("*").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Products with Categories and Stock Balances
  const { data: products = [], isLoading } = useQuery<ProductWithDetails[]>({
    queryKey: ["products", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*, category:categories(*)")
        .order("created_at", { ascending: false });
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;

      // Also get inventory total for bulk items
      const { data: invRows } = await supabase.from("inventory").select("product_id, quantity");
      const invMap = new Map<string, number>();
      invRows?.forEach((r) => {
        invMap.set(r.product_id, (invMap.get(r.product_id) || 0) + r.quantity);
      });

      return (data || []).map((p) => ({
        ...p,
        total_stock: invMap.get(p.id) || 0,
      }));
    },
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setName("");
    setSku(generateAutoSKU("PRD"));
    setBarcode("");
    setCategoryId(categories[0]?.id || "");
    setDescription("");
    setUnit("pcs");
    setTrackingMode("bulk");
    setPurchasePrice("0");
    setSellingPrice("0");
    setMinStock("5");
    setStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode || "");
    setCategoryId(p.category_id || "");
    setDescription(p.description || "");
    setUnit(p.unit);
    setTrackingMode(p.tracking_mode);
    setPurchasePrice(String(p.purchase_price));
    setSellingPrice(String(p.selling_price));
    setMinStock(String(p.min_stock));
    setStatus(p.status);
    setModalOpen(true);
  };

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!name.trim()) throw new Error("Product name is required");
      if (!sku.trim()) throw new Error("SKU is required");

      const payload = {
        organization_id: currentOrg.id,
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        category_id: categoryId || null,
        description: description.trim() || null,
        unit: unit.trim() || "pcs",
        tracking_mode: trackingMode,
        purchase_price: Number(purchasePrice) || 0,
        selling_price: Number(sellingPrice) || 0,
        min_stock: Number(minStock) || 0,
        status,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success(editingProduct ? "Product updated" : "Product registered successfully");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save product");
    },
  });

  // Archive / Restore Mutation
  const toggleArchiveMutation = useMutation({
    mutationFn: async (p: Product) => {
      const nextStatus = p.status === "active" ? "archived" : "active";
      const { error } = await supabase
        .from("products")
        .update({ status: nextStatus })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product status updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to change status");
    },
  });

  // Columns Configuration
  const columns: ColumnDef<ProductWithDetails>[] = [
    {
      accessorKey: "name",
      header: "Product / SKU",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{row.original.name}</span>
          <span className="text-xs text-slate-500 font-mono">SKU: {row.original.sku}</span>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs font-normal">
          {row.original.category?.name || "Uncategorized"}
        </Badge>
      ),
    },
    {
      accessorKey: "tracking_mode",
      header: "Tracking",
      cell: ({ row }) => (
        <Badge
          variant={row.original.tracking_mode === "bulk" ? "secondary" : "info"}
          className="text-xs capitalize font-medium"
        >
          {row.original.tracking_mode === "bulk" ? "Bulk Consumable" : "Serialized Asset"}
        </Badge>
      ),
    },
    {
      accessorKey: "total_stock",
      header: "Current Stock",
      cell: ({ row }) => {
        if (row.original.tracking_mode === "serialized") {
          return <span className="text-xs text-slate-400">See Asset Register</span>;
        }
        const qty = row.original.total_stock || 0;
        const isLow = qty <= row.original.min_stock;
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold ${isLow ? "text-amber-600" : "text-slate-800"}`}>
              {qty} {row.original.unit}
            </span>
            {isLow && (
              <Badge variant="warning" className="text-[10px] px-1 py-0">
                Low
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "purchase_price",
      header: "Cost Price",
      cell: ({ row }) => formatCurrency(row.original.purchase_price),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "success" : "secondary"}
          className="capitalize text-xs"
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-500 hover:text-slate-900"
              title="Barcode & QR Code"
              onClick={() => setBarcodeModalItem(p)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
            {can("products:edit") && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-500 hover:text-blue-600"
                title="Edit Product"
                onClick={() => openEditModal(p)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {can("products:archive") && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                title={p.status === "active" ? "Archive" : "Activate"}
                onClick={() => toggleArchiveMutation.mutate(p)}
              >
                {p.status === "active" ? (
                  <Archive className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Product Catalog</h2>
          <p className="text-xs text-slate-500">
            Define corporate consumable items and serialized hardware equipment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can("products:create") && (
            <Button onClick={openCreateModal} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
              <Plus className="h-4 w-4" />
              New Product
            </Button>
          )}
        </div>
      </div>

      {/* TanStack Table */}
      <DataTable
        columns={columns}
        data={products}
        searchPlaceholder="Search product by name, SKU..."
        exportFilename="inventory_products"
        reportTitle="Corporate Product Catalog"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      {/* Create / Edit Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Register New Product"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter product specifications, inventory tracking method, and cost valuation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Product Name *</Label>
              <Input
                placeholder="e.g. Ergonomic Keyboard or A4 Copy Paper"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>SKU *</Label>
                <button
                  type="button"
                  onClick={() => setSku(generateAutoSKU("PRD"))}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto
                </button>
              </div>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Barcode (EAN/UPC)</Label>
              <Input
                placeholder="Optional barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Tracking Mode</Label>
              <Select
                value={trackingMode}
                onValueChange={(val: any) => setTrackingMode(val)}
                disabled={!!editingProduct}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulk" className="text-xs">
                    Bulk (Consumable Balances)
                  </SelectItem>
                  <SelectItem value="serialized" className="text-xs">
                    Serialized (Individual Assets)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Unit of Measure</Label>
              <Input
                placeholder="pcs, box, unit, roll"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Minimum Stock Alert</Label>
              <Input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Purchase Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Selling / Valuation ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Technical specifications, model notes, vendor details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saveMutation.isPending ? "Saving..." : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Display Modal */}
      {barcodeModalItem && (
        <BarcodeModal
          isOpen={!!barcodeModalItem}
          onClose={() => setBarcodeModalItem(null)}
          title={barcodeModalItem.name}
          code={barcodeModalItem.barcode || barcodeModalItem.sku}
          secondaryText={`SKU: ${barcodeModalItem.sku}`}
          orgName={currentOrg?.name}
          type="product"
        />
      )}
    </div>
  );
}
