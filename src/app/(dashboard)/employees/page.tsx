"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Employee } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, User, Mail, Phone, Briefcase, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface EmployeeWithAssets extends Employee {
  active_assignments_count?: number;
}

export default function EmployeesPage() {
  const { currentOrg } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalEmployee, setDetailModalEmployee] = useState<Employee | null>(null);
  const [employeeAssignments, setEmployeeAssignments] = useState<any[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const { data: employees = [], isLoading } = useQuery<EmployeeWithAssets[]>({
    queryKey: ["employees", currentOrg?.id],
    queryFn: async () => {
      let q = supabase.from("employees").select("*").order("full_name");
      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
      const { data, error } = await q;
      if (error) throw error;

      // Count active assignments
      const { data: assignments } = await supabase
        .from("asset_assignments")
        .select("employee_id")
        .eq("status", "active");

      const countMap = new Map<string, number>();
      assignments?.forEach((a) => {
        countMap.set(a.employee_id, (countMap.get(a.employee_id) || 0) + 1);
      });

      return (data || []).map((e) => ({
        ...e,
        active_assignments_count: countMap.get(e.id) || 0,
      }));
    },
  });

  const openCreateModal = () => {
    setEditingEmployee(null);
    setEmployeeCode(`EMP-${1000 + employees.length + 1}`);
    setFullName("");
    setDepartment("Engineering");
    setPosition("");
    setEmail("");
    setPhone("");
    setStatus("active");
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmployeeCode(emp.employee_code);
    setFullName(emp.full_name);
    setDepartment(emp.department);
    setPosition(emp.position);
    setEmail(emp.email || "");
    setPhone(emp.phone || "");
    setStatus(emp.status);
    setModalOpen(true);
  };

  const openDetailModal = async (emp: Employee) => {
    setDetailModalEmployee(emp);
    // Fetch all assignments for this employee
    const { data } = await supabase
      .from("asset_assignments")
      .select("*, asset:assets(*, product:products(*))")
      .eq("employee_id", emp.id)
      .order("assigned_at", { ascending: false });
    setEmployeeAssignments(data || []);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!employeeCode.trim()) throw new Error("Employee code is required");
      if (!fullName.trim()) throw new Error("Full name is required");
      if (!department.trim()) throw new Error("Department is required");
      if (!position.trim()) throw new Error("Position is required");

      const payload = {
        organization_id: currentOrg.id,
        employee_code: employeeCode.trim(),
        full_name: fullName.trim(),
        department: department.trim(),
        position: position.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
      };

      if (editingEmployee) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editingEmployee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editingEmployee ? "Employee updated" : "Employee registered");
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save employee");
    },
  });

  const columns: ColumnDef<EmployeeWithAssets>[] = [
    {
      accessorKey: "full_name",
      header: "Employee / Code",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 text-xs">
            {row.original.full_name.charAt(0)}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{row.original.full_name}</span>
            <span className="text-xs text-slate-500 font-mono">{row.original.employee_code}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: "Department & Role",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800 text-xs">{row.original.department}</span>
          <span className="text-slate-500 text-[11px]">{row.original.position}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs text-slate-600">
          <span>{row.original.email || "-"}</span>
          <span className="text-slate-400 text-[11px]">{row.original.phone || "-"}</span>
        </div>
      ),
    },
    {
      accessorKey: "active_assignments_count",
      header: "Assigned Assets",
      cell: ({ row }) => {
        const count = row.original.active_assignments_count || 0;
        return (
          <Badge variant={count > 0 ? "default" : "outline"} className="text-xs">
            {count} {count === 1 ? "Asset" : "Assets"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "success" : "secondary"}
          className="text-xs capitalize"
        >
          {row.original.status}
        </Badge>
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
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
            title="View Assigned Assets & History"
            onClick={() => openDetailModal(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-500 hover:text-blue-600"
            title="Edit Employee"
            onClick={() => openEditModal(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Personnel & Staff Register</h2>
          <p className="text-xs text-slate-500">
            Company employees eligible for hardware and device assignments.
          </p>
        </div>
        <Button onClick={openCreateModal} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs">
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={employees}
        searchPlaceholder="Search employee by name, code, dept..."
        exportFilename="employees"
        reportTitle="Staff & Personnel Register"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      {/* Edit / Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee Record"}</DialogTitle>
            <DialogDescription className="text-xs">
              Staff details for device issuance, custodian tracking, and returns.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Employee ID / Code *</Label>
              <Input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Employment Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Inactive / Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Input
                placeholder="Engineering, Design, Finance"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Job Position *</Label>
              <Input
                placeholder="Platform Architect, Manager"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Work Email</Label>
              <Input
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs"
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
              {saveMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Assigned Assets Overview Modal */}
      <Dialog open={!!detailModalEmployee} onOpenChange={() => setDetailModalEmployee(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              {detailModalEmployee?.full_name} — Equipment Portfolio
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailModalEmployee?.position} • {detailModalEmployee?.department} ({detailModalEmployee?.employee_code})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Asset Custodianship History
            </h4>
            {employeeAssignments.length > 0 ? (
              <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden">
                {employeeAssignments.map((a) => (
                  <div key={a.id} className="p-3 bg-white flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-900">
                        {a.asset?.product?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Tag: {a.asset?.asset_tag} • S/N: {a.asset?.serial_number}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Issued: {formatDate(a.assigned_at)}{" "}
                        {a.returned_at ? `| Returned: ${formatDate(a.returned_at)}` : ""}
                      </div>
                    </div>
                    <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                      {a.status === "active" ? "In Possession" : "Returned"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No equipment assignments recorded for this employee.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setDetailModalEmployee(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
