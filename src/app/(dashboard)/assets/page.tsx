"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Asset, AssetWithDetails, AssetStatus, AssetCondition } from "@/types";
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
import { generateAutoAssetTag } from "@/lib/barcode/generator";
import {
  Plus,
  QrCode,
  Edit,
  Sparkles,
  MapPin,
  Calendar,
  AlertTriangle,
  Wrench,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AssetsPage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [barcodeModalItem, setBarcodeModalItem] = useState<AssetWithDetails | null>(null);
  const [statusChangeModalAsset, setStatusChangeModalAsset] = useState<Asset | null>(null);
  const [newStatus, setNewStatus] = useState<AssetStatus>("maintenance");
  const [statusChangeNotes, setStatusChangeNotes] = useState("");

  // Form State
  const [productId, setProductId] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [barcode, setBarcode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [warrantyExpiration, setWarrantyExpiration] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch Serialized Products
  const { data: serializedProducts = [] } = useQuery({
    queryKey: ["serialized-products", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, sku")
        .eq("tracking_mode", "serialized")
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
      let q = supabase.from("warehouses").select("id, name").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Locations
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("locations").select("id, name, warehouse_id").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Assets with Product, Warehouse, and Active Assignment info
  const { data: assets = [], isLoading } = useQuery<AssetWithDetails[]>({
    queryKey: ["assets", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("*, product:products(*), warehouse:warehouses(*), location:locations(*)")
        .order("created_at", { ascending: false });
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;

      // Also fetch active assignments
      const { data: activeAssignments } = await supabase
        .from("asset_assignments")
        .select("*, employee:employees(*)")
        .eq("status", "active");

      const assignMap = new Map<string, any>();
      activeAssignments?.forEach((a) => {
        assignMap.set(a.asset_id, a);
      });

      return (data || []).map((a) => ({
        ...a,
        current_assignment: assignMap.get(a.id) || null,
      })) as any;
    },
  });

  const openCreateModal = () => {
    setEditingAsset(null);
    setProductId(serializedProducts[0]?.id || "");
    setAssetTag(generateAutoAssetTag());
    setSerialNumber("");
    setBarcode("");
    setWarehouseId(warehouses[0]?.id || "");
    setLocationId("");
    setCondition("new");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setPurchasePrice("0");
    setWarrantyExpiration("");
    setNotes("");
    setModalOpen(true);
  };

  const openEditModal = (a: Asset) => {
    setEditingAsset(a);
    setProductId(a.product_id);
    setAssetTag(a.asset_tag);
    setSerialNumber(a.serial_number);
    setBarcode(a.barcode || "");
    setWarehouseId(a.warehouse_id || "");
    setLocationId(a.location_id || "");
    setCondition(a.condition);
    setPurchaseDate(a.purchase_date || "");
    setPurchasePrice(String(a.purchase_price || 0));
    setWarrantyExpiration(a.warranty_expiration || "");
    setNotes(a.notes || "");
    setModalOpen(true);
  };

  // Save Asset Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!productId) throw new Error("Please select a product");
      if (!assetTag.trim()) throw new Error("Asset tag is required");
      if (!serialNumber.trim()) throw new Error("Serial number is required");

      const payload = {
        organization_id: currentOrg.id,
        product_id: productId,
        asset_tag: assetTag.trim(),
        serial_number: serialNumber.trim(),
        barcode: barcode.trim() || assetTag.trim(),
        warehouse_id: warehouseId || null,
        location_id: locationId || null,
        condition,
        status: editingAsset ? editingAsset.status : "available",
        purchase_date: purchaseDate || null,
        purchase_price: Number(purchasePrice) || 0,
        warranty_expiration: warrantyExpiration || null,
        notes: notes.trim() || null,
      };

      if (editingAsset) {
        const { error } = await supabase.from("assets").update(payload).eq("id", editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success(editingAsset ? "Asset updated" : "Asset registered successfully");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save asset");
    },
  });

  // Status Change (Maintenance / Damaged / Dispose) RPC Mutation
  const statusChangeMutation = useMutation({
    mutationFn: async () => {
      if (!statusChangeModalAsset || !currentOrg?.id) return;

      const { data, error } = await (supabase.rpc as any)("process_asset_status_change", {
        p_org_id: currentOrg.id,
        p_asset_id: statusChangeModalAsset.id,
        p_new_status: newStatus,
        p_notes: statusChangeNotes.trim() || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success(`Asset status updated to ${newStatus}`);
      setStatusChangeModalAsset(null);
      setStatusChangeNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update asset status");
    },
  });

  const columns: ColumnDef<AssetWithDetails>[] = [
    {
      accessorKey: "asset_tag",
      header: "Asset Tag / Serial",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 font-mono">{row.original.asset_tag}</span>
          <span className="text-xs text-slate-500 font-mono">S/N: {row.original.serial_number}</span>
        </div>
      ),
    },
    {
      accessorKey: "product.name",
      header: "Product / Model",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs">{row.original.product?.name}</span>
          <span className="text-[11px] text-slate-500">SKU: {row.original.product?.sku}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Asset Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variants: Record<string, any> = {
          available: "success",
          assigned: "default",
          maintenance: "warning",
          damaged: "destructive",
          lost: "destructive",
          disposed: "secondary",
        };
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={variants[s] || "outline"} className="text-xs capitalize font-medium">
              {s}
            </Badge>
            {row.original.current_assignment && (
              <span className="text-[10px] text-blue-600 font-medium">
                To: {row.original.current_assignment.employee?.full_name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "condition",
      header: "Condition",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize font-normal">
          {row.original.condition}
        </Badge>
      ),
    },
    {
      accessorKey: "location",
      header: "Depot & Location",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {row.original.warehouse?.name || "Unassigned"}
            {row.original.location ? ` • ${row.original.location.name}` : ""}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "warranty_expiration",
      header: "Warranty",
      cell: ({ row }) => {
        if (!row.original.warranty_expiration) return <span className="text-xs text-slate-400">-</span>;
        const exp = new Date(row.original.warranty_expiration);
        const isExpired = exp < new Date();
        return (
          <span className={`text-xs ${isExpired ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
            {formatDate(row.original.warranty_expiration)}
            {isExpired && " (Expired)"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const a = row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-500 hover:text-slate-900"
              title="Barcode & QR Code"
              onClick={() => setBarcodeModalItem(a)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
            {can("assets:edit") && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-500 hover:text-blue-600"
                title="Edit Asset"
                onClick={() => openEditModal(a)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {can("assets:dispose") && a.status !== "assigned" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                title="Change Status (Maintenance / Dispose)"
                onClick={() => {
                  setStatusChangeModalAsset(a);
                  setNewStatus(a.status === "maintenance" ? "available" : "maintenance");
                }}
              >
                <Wrench className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Fixed Asset Register</h2>
          <p className="text-xs text-slate-500">
            Lifecycle registry for individually tagged and serialized hardware equipment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can("assets:create") && (
            <Button onClick={openCreateModal} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
              <Plus className="h-4 w-4" />
              Register Asset
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={assets}
        searchPlaceholder="Search asset tag, serial, product..."
        exportFilename="fixed_assets_register"
        reportTitle="Corporate Fixed Asset Register"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      {/* Register / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAsset ? "Edit Asset Details" : "Register Serialized Asset"}</DialogTitle>
            <DialogDescription className="text-xs">
              Register individual equipment units into corporate custody.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Product Model *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select serialized product" />
                </SelectTrigger>
                <SelectContent>
                  {serializedProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Asset Tag *</Label>
                <button
                  type="button"
                  onClick={() => setAssetTag(generateAutoAssetTag())}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto
                </button>
              </div>
              <Input
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Serial Number (S/N) *</Label>
              <Input
                placeholder="Manufacturer serial number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Assigned Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Specific Location / Room</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select sub-location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={(val: any) => setCondition(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new" className="text-xs">Brand New</SelectItem>
                  <SelectItem value="good" className="text-xs">Good</SelectItem>
                  <SelectItem value="fair" className="text-xs">Fair</SelectItem>
                  <SelectItem value="poor" className="text-xs">Poor</SelectItem>
                  <SelectItem value="damaged" className="text-xs">Damaged</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Warranty Expiration</Label>
              <Input
                type="date"
                value={warrantyExpiration}
                onChange={(e) => setWarrantyExpiration(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Equipment Notes</Label>
              <Textarea
                placeholder="Hardware specs, MAC address, charger accessories included..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              {saveMutation.isPending ? "Saving..." : "Save Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Modal (e.g. Maintenance, Dispose, Damaged) */}
      <Dialog open={!!statusChangeModalAsset} onOpenChange={() => setStatusChangeModalAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status: {statusChangeModalAsset?.asset_tag}</DialogTitle>
            <DialogDescription className="text-xs">
              Change status for repair, maintenance, or lifecycle disposal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>New Status *</Label>
              <Select value={newStatus} onValueChange={(val: any) => setNewStatus(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available" className="text-xs">Available for Issuance</SelectItem>
                  <SelectItem value="maintenance" className="text-xs">In Maintenance / Service</SelectItem>
                  <SelectItem value="damaged" className="text-xs">Damaged</SelectItem>
                  <SelectItem value="lost" className="text-xs">Lost / Missing</SelectItem>
                  <SelectItem value="disposed" className="text-xs">Decommissioned / Disposed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes & Reason</Label>
              <Textarea
                placeholder="Reason for status change..."
                value={statusChangeNotes}
                onChange={(e) => setStatusChangeNotes(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStatusChangeModalAsset(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => statusChangeMutation.mutate()}
              disabled={statusChangeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {statusChangeMutation.isPending ? "Updating..." : "Confirm Status Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode & QR Modal */}
      {barcodeModalItem && (
        <BarcodeModal
          isOpen={!!barcodeModalItem}
          onClose={() => setBarcodeModalItem(null)}
          title={barcodeModalItem.product?.name || "Asset"}
          code={barcodeModalItem.asset_tag}
          secondaryText={`S/N: ${barcodeModalItem.serial_number}`}
          orgName={currentOrg?.name}
          type="asset"
        />
      )}
    </div>
  );
}
