"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { MaintenanceRecordWithDetails, MaintenanceType, MaintenanceStatus } from "@/types";
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
import { Wrench, Plus, CheckCircle2, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AssetMaintenancePage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [completeModalRecord, setCompleteModalRecord] = useState<MaintenanceRecordWithDetails | null>(null);

  // Form State
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>("corrective");
  const [cost, setCost] = useState("0");
  const [serviceProvider, setServiceProvider] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [completionDate, setCompletionDate] = useState("");
  const [status, setStatus] = useState<MaintenanceStatus>("in_progress");
  const [description, setDescription] = useState("");

  // Fetch Assets
  const { data: assets = [] } = useQuery({
    queryKey: ["assets", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("id, asset_tag, serial_number, product:products(name)")
        .order("asset_tag");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return (data || []) as any;
    },
  });

  // Fetch Maintenance Records
  const { data: records = [], isLoading } = useQuery<MaintenanceRecordWithDetails[]>({
    queryKey: ["maintenance-records", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("maintenance_records")
        .select("*, asset:assets(*, product:products(*))")
        .order("start_date", { ascending: false });
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const openCreateModal = () => {
    setAssetId(assets[0]?.id || "");
    setTitle("");
    setMaintenanceType("preventive");
    setCost("0");
    setServiceProvider("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setCompletionDate("");
    setStatus("in_progress");
    setDescription("");
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!assetId) throw new Error("Please select an asset");
      if (!title.trim()) throw new Error("Title is required");

      const payload = {
        organization_id: currentOrg.id,
        asset_id: assetId,
        title: title.trim(),
        maintenance_type: maintenanceType,
        cost: Number(cost) || 0,
        service_provider: serviceProvider.trim() || null,
        start_date: startDate,
        completion_date: completionDate || null,
        status,
        description: description.trim() || null,
      };

      const { error } = await supabase.from("maintenance_records").insert(payload);
      if (error) throw error;

      // Update asset status to 'maintenance' if in_progress
      if (status === "in_progress") {
        await supabase.from("assets").update({ status: "maintenance" }).eq("id", assetId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Maintenance work order created");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create record");
    },
  });

  const markCompletedMutation = useMutation({
    mutationFn: async (record: MaintenanceRecordWithDetails) => {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("maintenance_records")
        .update({
          status: "completed",
          completion_date: today,
        })
        .eq("id", record.id);

      if (error) throw error;

      // Restore asset status to available
      await supabase.from("assets").update({ status: "available" }).eq("id", record.asset_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Maintenance marked completed and asset restored to available stock");
      setCompleteModalRecord(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update record");
    },
  });

  const columns: ColumnDef<MaintenanceRecordWithDetails>[] = [
    {
      accessorKey: "title",
      header: "Maintenance Task",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900">{row.original.title}</span>
          <span className="text-xs text-slate-500">{row.original.service_provider || "Internal IT"}</span>
        </div>
      ),
    },
    {
      accessorKey: "asset.asset_tag",
      header: "Target Equipment",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs font-mono">
            {row.original.asset?.asset_tag}
          </span>
          <span className="text-[11px] text-slate-500">
            {row.original.asset?.product?.name}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "maintenance_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.original.maintenance_type}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        const variants: Record<string, any> = {
          completed: "success",
          in_progress: "warning",
          scheduled: "info",
          cancelled: "secondary",
        };
        return (
          <Badge variant={variants[s] || "outline"} className="text-xs capitalize">
            {s.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "cost",
      header: "Repair Cost",
      cell: ({ row }) => formatCurrency(row.original.cost),
    },
    {
      accessorKey: "start_date",
      header: "Timeline",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs text-slate-600">
          <span>Started: {formatDate(row.original.start_date)}</span>
          {row.original.completion_date && (
            <span className="text-slate-400 text-[11px]">
              Done: {formatDate(row.original.completion_date)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "completed" || r.status === "cancelled") return null;

        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              onClick={() => markCompletedMutation.mutate(r)}
            >
              <Check className="h-3.5 w-3.5" />
              Complete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-600" />
            Asset Maintenance & Repair Log
          </h2>
          <p className="text-xs text-slate-500">
            Track scheduled servicing, preventive maintenance, and vendor repair costs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can("assets:maintain") && (
            <Button
              onClick={openCreateModal}
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
            >
              <Plus className="h-4 w-4" />
              New Work Order
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        searchPlaceholder="Search task, asset tag, provider..."
        exportFilename="asset_maintenance_records"
        reportTitle="Equipment Maintenance & Repair Ledger"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      {/* Create Maintenance Work Order Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Maintenance Work Order</DialogTitle>
            <DialogDescription className="text-xs">
              Log equipment servicing, upgrades, or external vendor repair.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Target Asset *</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select equipment to service" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.asset_tag} — {a.product?.name} (S/N: {a.serial_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Work Order Title *</Label>
              <Input
                placeholder="e.g. Battery Replacement, Screen Repair, Firmware Upgrade"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Maintenance Type</Label>
              <Select value={maintenanceType} onValueChange={(val: any) => setMaintenanceType(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive" className="text-xs">Preventive Routine</SelectItem>
                  <SelectItem value="corrective" className="text-xs">Corrective Repair</SelectItem>
                  <SelectItem value="inspection" className="text-xs">Audit & Inspection</SelectItem>
                  <SelectItem value="upgrade" className="text-xs">Hardware Upgrade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estimated / Actual Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Service Provider / Technician</Label>
              <Input
                placeholder="Apple Authorized, NexTech, or Internal"
                value={serviceProvider}
                onChange={(e) => setServiceProvider(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                  <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Completion Date</Label>
              <Input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Diagnostic Notes</Label>
              <Textarea
                placeholder="Issue reported, parts replaced, invoice numbers..."
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
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !assetId || !title.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? "Creating..." : "Save Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
