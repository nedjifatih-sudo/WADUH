"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Location } from "@/types";
import { Button } from "@/components/ui/button";
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
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface LocationWithWarehouse extends Location {
  warehouse?: { name: string } | null;
}

export default function LocationsPage() {
  const { currentOrg } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const [warehouseId, setWarehouseId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("warehouses").select("id, name").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: locations = [], isLoading } = useQuery<LocationWithWarehouse[]>({
    queryKey: ["locations", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("locations")
        .select("*, warehouse:warehouses(name)")
        .order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const openCreateModal = () => {
    setEditingLocation(null);
    setWarehouseId(warehouses[0]?.id || "");
    setName("");
    setDescription("");
    setModalOpen(true);
  };

  const openEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setWarehouseId(loc.warehouse_id);
    setName(loc.name);
    setDescription(loc.description || "");
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!warehouseId) throw new Error("Warehouse selection is required");
      if (!name.trim()) throw new Error("Room/Location name is required");

      const payload = {
        organization_id: currentOrg.id,
        warehouse_id: warehouseId,
        name: name.trim(),
        description: description.trim() || null,
      };

      if (editingLocation) {
        const { error } = await supabase.from("locations").update(payload).eq("id", editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success(editingLocation ? "Location updated" : "Location created");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save location");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete location");
    },
  });

  const columns: ColumnDef<LocationWithWarehouse>[] = [
    {
      accessorKey: "name",
      header: "Room / Sub-location",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-900">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "warehouse",
      header: "Parent Facility",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-700">
          {row.original.warehouse?.name || "-"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Details / Shelf Notes",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 line-clamp-1">{row.original.description || "-"}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-500 hover:text-blue-600"
            onClick={() => openEditModal(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-500 hover:text-rose-600"
            onClick={() => {
              if (confirm("Delete this sub-location?")) {
                deleteMutation.mutate(row.original.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Specific Rooms & Locations</h2>
          <p className="text-xs text-slate-500">
            Aisles, server racks, cabinets, and storage zones within warehouses.
          </p>
        </div>
        <Button onClick={openCreateModal} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
          <Plus className="h-4 w-4" />
          New Location
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={locations}
        searchPlaceholder="Search locations..."
        exportFilename="locations"
        reportTitle="Warehouse Sub-Locations"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "New Sub-Location / Room"}</DialogTitle>
            <DialogDescription className="text-xs">
              Specific area where equipment or supplies are situated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Parent Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select Warehouse" />
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
              <Label>Room / Shelf / Aisle Name *</Label>
              <Input
                placeholder="e.g. Room 101 - IT Storage Rack 4"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Location Notes</Label>
              <Textarea
                placeholder="Keycard access required, top shelf, bin number..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              {saveMutation.isPending ? "Saving..." : "Save Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
