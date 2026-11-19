"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { UserRole } from "@/types";
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
import { UserCog, Plus, ShieldCheck, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface OrgMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  profile?: { full_name: string; email: string; avatar_url: string | null } | null;
}

export default function UsersAndRolesPage() {
  const { currentOrg, can } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [role, setRole] = useState<UserRole>("staff");

  const { data: members = [], isLoading } = useQuery<OrgMemberRow[]>({
    queryKey: ["org-members", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("organization_members")
        .select("*, profile:profiles(*)")
        .order("created_at");

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("No active organization");
      if (!memberEmail.trim()) throw new Error("Email is required");

      // Check if profile exists for this email
      let { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", memberEmail.trim())
        .maybeSingle();

      let userId = existingProfile?.id;

      // If not exists, insert a profile placeholder
      if (!userId) {
        userId = crypto.randomUUID();
        await supabase.from("profiles").insert({
          id: userId,
          full_name: memberName.trim() || memberEmail.split("@")[0],
          email: memberEmail.trim(),
        });
      }

      // Add to organization_members
      const { error } = await supabase.from("organization_members").insert({
        organization_id: currentOrg.id,
        user_id: userId,
        role,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Team member added with assigned role");
      setModalOpen(false);
      setMemberEmail("");
      setMemberName("");
      setRole("staff");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add member");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: UserRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Role permissions updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update role");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Member removed from organization");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove member");
    },
  });

  const columns: ColumnDef<OrgMemberRow>[] = [
    {
      accessorKey: "profile.full_name",
      header: "User / Email",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center text-xs">
            {row.original.profile?.full_name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 text-xs">
              {row.original.profile?.full_name || "User"}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {row.original.profile?.email || "-"}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Access Role",
      cell: ({ row }) => {
        const member = row.original;
        return (
          <Select
            value={member.role}
            onValueChange={(val: UserRole) =>
              updateRoleMutation.mutate({ memberId: member.id, newRole: val })
            }
          >
            <SelectTrigger className="w-36 h-8 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="super_admin" className="text-xs">Super Admin</SelectItem>
              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
              <SelectItem value="manager" className="text-xs">Manager</SelectItem>
              <SelectItem value="staff" className="text-xs">Staff</SelectItem>
              <SelectItem value="viewer" className="text-xs">Viewer (Read-Only)</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: "Member Since",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">{formatDate(row.original.created_at)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const member = row.original;
        if (member.role === "super_admin" && members.filter((m) => m.role === "super_admin").length <= 1) {
          return null; // Don't remove the sole super admin
        }
        return (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-slate-400 hover:text-rose-600"
              onClick={() => {
                if (confirm(`Revoke workspace access for ${member.profile?.email}?`)) {
                  removeMemberMutation.mutate(member.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
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
            <UserCog className="h-5 w-5 text-blue-600" />
            Users & Role-Based Permissions
          </h2>
          <p className="text-xs text-slate-500">
            Control multi-tenant member permissions across Super Admin, Admin, Manager, Staff, and Viewer roles.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={members}
        searchPlaceholder="Search member name, email..."
        exportFilename="organization_members"
        reportTitle="Organization Membership & Role Register"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription className="text-xs">
              Grant a user access to the {currentOrg?.name} workspace with defined role privileges.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Work Email *</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Full Name (Optional)</Label>
              <Input
                placeholder="Jane Smith"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(val: UserRole) => setRole(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin" className="text-xs">
                    Super Admin (Full system configuration)
                  </SelectItem>
                  <SelectItem value="admin" className="text-xs">
                    Admin (Catalog, inventory, assets, users)
                  </SelectItem>
                  <SelectItem value="manager" className="text-xs">
                    Manager (Approve adjustments, view reports & audit)
                  </SelectItem>
                  <SelectItem value="staff" className="text-xs">
                    Staff (Stock in/out, asset assign & return)
                  </SelectItem>
                  <SelectItem value="viewer" className="text-xs">
                    Viewer (Read-only reports and balances)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !memberEmail.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {inviteMutation.isPending ? "Adding..." : "Add to Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
