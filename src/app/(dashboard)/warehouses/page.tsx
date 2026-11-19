"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Warehouse } from "@/types";
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
import { Plus, Edit, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { toast } from "sonner";

export default function WarehousesPage() {
  const { currentOrg } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ["warehouses", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("warehouses").select("*").order("name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const openCreateModal = () => {
    setEditingWarehouse(null);
    setName("");
    setCode(`WH-0${warehouses.length + 1}`);
    setAddress("");
    setDescription("");
    setModalOpen(true);
  };

  const openEditModal = (w: Warehouse) => {
    setEditingWarehouse(w);
    setName(w.name);
    setCode(w.code || "");
    setAddress(w.address || "");
    setDescription(w.description || "");
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!name.trim()) throw new Error("Warehouse name is required");

      const payload = {
        organization_id: currentOrg.id,
        name: name.trim(),
        code: code.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
      };

      if (editingWarehouse) {
        const { error } = await supabase.from("warehouses").update(payload).eq("id", editingWarehouse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("warehouses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(editingWarehouse ? "Warehouse updated" : "Warehouse created");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save warehouse");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete warehouse");
    },
  });

  const columns: ColumnDef<Warehouse>[] = [
    {
      accessorKey: "name",
      header: "Warehouse Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-blue-50 text-blue-600">
            <WarehouseIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{row.original.name}</span>
            <span className="text-xs text-slate-500 font-mono">Code: {row.original.code || "-"}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "address",
      header: "Facility Address",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 line-clamp-1">{row.original.address || "-"}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description / Notes",
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
              if (confirm("Delete this warehouse facility?")) {
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Warehouses & Storage Facilities</h2>
          <p className="text-xs text-slate-500">
            Define main vaults, regional distribution depots, and storage rooms.
          </p>
        </div>
        <Button onClick={openCreateModal} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
          <Plus className="h-4 w-4" />
          New Warehouse
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={warehouses}
        searchPlaceholder="Search warehouse..."
        exportFilename="warehouses"
        reportTitle="Warehouse Register"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "New Warehouse Facility"}</DialogTitle>
            <DialogDescription className="text-xs">
              Physical depot or building housing corporate assets and supplies.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Facility Name *</Label>
              <Input
                placeholder="e.g. Headquarters Main Vault"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Facility Code</Label>
              <Input
                placeholder="WH-HQ-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Physical Location Address</Label>
              <Input
                placeholder="Tower B, Basement Storage 1, Floor -1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Operational Description</Label>
              <Textarea
                placeholder="Capacity notes, climate control, security clearance..."
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
              {saveMutation.isPending ? "Saving..." : "Save Facility"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
