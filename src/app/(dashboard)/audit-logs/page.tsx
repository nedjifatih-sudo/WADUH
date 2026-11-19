"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { AuditLog } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollText, Eye, ShieldCheck, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AuditLogWithUser extends AuditLog {
  profile?: { full_name: string; email: string } | null;
}

export default function AuditLogsPage() {
  const { currentOrg } = useAuth();
  const supabase = createClient();
  const [inspectLog, setInspectLog] = useState<AuditLogWithUser | null>(null);

  const { data: logs = [], isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["audit-logs", currentOrg?.id],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*, profile:profiles(full_name, email)")
        .order("created_at", { ascending: false });

      if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const columns: ColumnDef<AuditLogWithUser>[] = [
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-slate-600">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "action",
      header: "Event Action",
      cell: ({ row }) => {
        const action = row.original.action;
        let variant: any = "outline";
        if (action.includes("IN")) variant = "success";
        if (action.includes("OUT")) variant = "warning";
        if (action.includes("ASSIGN")) variant = "default";
        if (action.includes("RETURN")) variant = "info";

        return (
          <Badge variant={variant} className="text-xs font-mono uppercase">
            {action}
          </Badge>
        );
      },
    },
    {
      accessorKey: "entity",
      header: "Target Entity",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-xs text-slate-800 capitalize">
            {row.original.entity}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {row.original.entity_id ? `${row.original.entity_id.slice(0, 8)}...` : "-"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "profile.full_name",
      header: "Operator",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-slate-900">
            {row.original.profile?.full_name || "System"}
          </span>
          <span className="text-[10px] text-slate-400">{row.original.profile?.email || "-"}</span>
        </div>
      ),
    },
    {
      id: "details",
      header: "Audit Payload",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1 text-slate-600"
          onClick={() => setInspectLog(row.original)}
        >
          <Eye className="h-3 w-3" />
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-blue-600" />
          System Security & Audit Trail
        </h2>
        <p className="text-xs text-slate-500">
          Immutable forensic log of ledger transactions, status transitions, and administrative events.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search action, entity, user..."
        exportFilename="audit_logs"
        reportTitle="System Security Audit Trail"
        orgName={currentOrg?.name}
        isLoading={isLoading}
      />

      {/* Inspect Log Dialog */}
      <Dialog open={!!inspectLog} onOpenChange={() => setInspectLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Event: {inspectLog?.action}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recorded on {formatDateTime(inspectLog?.created_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <span className="font-semibold text-slate-600">Entity: </span>
              <span className="capitalize">{inspectLog?.entity}</span> ({inspectLog?.entity_id})
            </div>

            {inspectLog?.old_values && (
              <div>
                <div className="font-semibold text-slate-600 mb-1">Previous Values:</div>
                <pre className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-36">
                  {JSON.stringify(inspectLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <div className="font-semibold text-slate-600 mb-1">New / Recorded Values:</div>
              <pre className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(inspectLog?.new_values, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
