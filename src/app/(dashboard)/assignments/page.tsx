"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { AssetAssignmentWithDetails, AssetCondition } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  UserCheck,
  RotateCcw,
  Plus,
  Briefcase,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { queueOfflineOperation } from "@/lib/offline/idb";

export default function AssetAssignmentsPage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnModalItem, setReturnModalItem] = useState<AssetAssignmentWithDetails | null>(null);

  // Assignment Form State
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignedAt, setAssignedAt] = useState(new Date().toISOString().split("T")[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");

  // Return Form State
  const [returnedCondition, setReturnedCondition] = useState<AssetCondition>("good");
  const [returnedNotes, setReturnedNotes] = useState("");

  // Fetch Available Assets for assignment
  const { data: availableAssets = [] } = useQuery({
    queryKey: ["available-assets", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("assets")
        .select("id, asset_tag, serial_number, product:products(name)")
        .eq("status", "available")
        .order("asset_tag");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return (data || []) as any;
    },
  });

  // Fetch Active Employees
  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select("id, employee_code, full_name, department")
        .eq("status", "active")
        .order("full_name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch Assignments
  const { data: assignments = [], isLoading } = useQuery<AssetAssignmentWithDetails[]>({
    queryKey: ["asset-assignments", currentOrg?.id, activeTab],
    queryFn: async () => {
      let q = supabase
        .from("asset_assignments")
        .select("*, asset:assets(*, product:products(*)), employee:employees(*)")
        .order("assigned_at", { ascending: false });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      if (activeTab === "active") {
        q = q.eq("status", "active");
      } else {
        q = q.eq("status", "returned");
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!selectedAssetId) throw new Error("Please select an asset");
      if (!selectedEmployeeId) throw new Error("Please select an employee");

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineOperation("asset_assignment", {
          organization_id: currentOrg.id,
          asset_id: selectedAssetId,
          employee_id: selectedEmployeeId,
          assigned_at: new Date(assignedAt).toISOString(),
          expected_return_date: expectedReturnDate || null,
          assignment_notes: assignmentNotes.trim() || null,
        });
        return { offline: true };
      }

      const { data, error } = await (supabase.rpc as any)("process_asset_assignment", {
        p_org_id: currentOrg.id,
        p_asset_id: selectedAssetId,
        p_employee_id: selectedEmployeeId,
        p_assigned_at: new Date(assignedAt).toISOString(),
        p_expected_return_date: expectedReturnDate || null,
        p_notes: assignmentNotes.trim() || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });

      if (res?.offline) {
        toast.info("Offline mode: Assignment queued in outbox.");
      } else {
        toast.success("Asset issued to employee successfully!");
      }

      setAssignModalOpen(false);
      setSelectedAssetId("");
      setSelectedEmployeeId("");
      setAssignmentNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign asset");
    },
  });

  // Return Mutation
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returnModalItem || !currentOrg?.id) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueOfflineOperation("asset_return", {
          organization_id: currentOrg.id,
          asset_id: returnModalItem.asset_id,
          returned_condition: returnedCondition,
          returned_notes: returnedNotes.trim() || null,
          returned_at: new Date().toISOString(),
        });
        return { offline: true };
      }

      const { data, error } = await (supabase.rpc as any)("process_asset_return", {
        p_org_id: currentOrg.id,
        p_asset_id: returnModalItem.asset_id,
        p_returned_condition: returnedCondition,
        p_returned_notes: returnedNotes.trim() || null,
        p_returned_at: new Date().toISOString(),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["asset-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });

      if (res?.offline) {
        toast.info("Offline mode: Return recorded in outbox.");
      } else {
        toast.success("Asset returned to inventory successfully!");
      }

      setReturnModalItem(null);
      setReturnedNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to return asset");
    },
  });

  const columns: ColumnDef<AssetAssignmentWithDetails>[] = [
    {
      accessorKey: "asset.asset_tag",
      header: "Asset Tag & Item",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 font-mono">
            {row.original.asset?.asset_tag}
          </span>
          <span className="text-xs text-slate-500">
            {row.original.asset?.product?.name} (S/N: {row.original.asset?.serial_number})
          </span>
        </div>
      ),
    },
    {
      accessorKey: "employee.full_name",
      header: "Custodian Employee",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 text-xs">
            {row.original.employee?.full_name}
          </span>
          <span className="text-[11px] text-slate-500">
            {row.original.employee?.department} ({row.original.employee?.employee_code})
          </span>
        </div>
      ),
    },
    {
      accessorKey: "assigned_at",
      header: "Assignment Period",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs text-slate-600">
          <span>Issued: {formatDate(row.original.assigned_at)}</span>
          {row.original.expected_return_date && (
            <span className="text-slate-400 text-[11px]">
              Due: {formatDate(row.original.expected_return_date)}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "secondary"}
          className="text-xs capitalize"
        >
          {row.original.status === "active" ? "In Possession" : "Returned"}
        </Badge>
      ),
    },
    {
      accessorKey: "assignment_notes",
      header: "Custody Notes",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 line-clamp-1">
          {row.original.assignment_notes || row.original.returned_notes || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const a = row.original;
        if (a.status !== "active") return null;

        return (
          <div className="flex items-center gap-1 justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => {
                setReturnModalItem(a);
                setReturnedCondition(a.asset?.condition || "good");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Receive Return
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
            <UserCheck className="h-5 w-5 text-blue-600" />
            Asset Custodianship & Issuance
          </h2>
          <p className="text-xs text-slate-500">
            Issue enterprise hardware to employees and process returns with condition audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can("assets:assign") && (
            <Button
              onClick={() => setAssignModalOpen(true)}
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
            >
              <Plus className="h-4 w-4" />
              Issue Asset
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList>
          <TabsTrigger value="active" className="text-xs">
            Active Deployments
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            Return History
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <DataTable
            columns={columns}
            data={assignments}
            searchPlaceholder="Search by asset tag, employee..."
            exportFilename={`asset_assignments_${activeTab}`}
            reportTitle="Asset Issuance & Custodianship Report"
            orgName={currentOrg?.name}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Issue / Assign Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Asset to Employee</DialogTitle>
            <DialogDescription className="text-xs">
              Assigns custodian responsibility for serialized corporate hardware.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Select Available Asset *</Label>
              <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select available device" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets.length > 0 ? (
                    availableAssets.map((a: any) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.asset_tag} — {a.product?.name} (S/N: {a.serial_number})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-slate-400 text-center">
                      No available assets found. Register new assets first.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assignee Employee *</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.full_name} ({e.employee_code} • {e.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Assignment Date</Label>
                <Input
                  type="date"
                  value={assignedAt}
                  onChange={(e) => setAssignedAt(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Expected Return (Optional)</Label>
                <Input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assignment Notes / Equipment Condition</Label>
              <Textarea
                placeholder="Included accessories: power brick, case, HDMI adapter..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || !selectedAssetId || !selectedEmployeeId}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {assignMutation.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Asset Dialog */}
      <Dialog open={!!returnModalItem} onOpenChange={() => setReturnModalItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receive Asset Return</DialogTitle>
            <DialogDescription className="text-xs">
              Confirm return of {returnModalItem?.asset?.asset_tag} from {returnModalItem?.employee?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border">
              <div>
                <span className="font-semibold text-slate-700">Device: </span>
                {returnModalItem?.asset?.product?.name}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Serial Number: </span>
                <span className="font-mono">{returnModalItem?.asset?.serial_number}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Custodian: </span>
                {returnModalItem?.employee?.full_name} ({returnModalItem?.employee?.department})
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Return Inspection Condition *</Label>
              <Select
                value={returnedCondition}
                onValueChange={(val: any) => setReturnedCondition(val)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new" className="text-xs">Brand New</SelectItem>
                  <SelectItem value="good" className="text-xs">Good (Normal wear)</SelectItem>
                  <SelectItem value="fair" className="text-xs">Fair (Cosmetic scratches)</SelectItem>
                  <SelectItem value="poor" className="text-xs">Poor (Heavy wear)</SelectItem>
                  <SelectItem value="damaged" className="text-xs">Damaged (Requires Repair)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Inspection Notes</Label>
              <Textarea
                placeholder="All cables returned, factory reset confirmed..."
                value={returnedNotes}
                onChange={(e) => setReturnedNotes(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReturnModalItem(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => returnMutation.mutate()}
              disabled={returnMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {returnMutation.isPending ? "Processing Return..." : "Confirm Return to Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
