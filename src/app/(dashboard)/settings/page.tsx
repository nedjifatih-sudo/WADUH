"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Building2,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  HardDrive,
  Trash2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { getAllOutboxItems, deleteOutboxItem } from "@/lib/offline/idb";
import { syncOutbox } from "@/lib/offline/sync";

export default function SettingsPage() {
  const { currentOrg, profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Form State
  const [orgName, setOrgName] = useState(currentOrg?.name || "");
  const [address, setAddress] = useState(currentOrg?.address || "");
  const [phone, setPhone] = useState(currentOrg?.phone || "");
  const [email, setEmail] = useState(currentOrg?.email || "");

  // Offline Engine State
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [outboxItems, setOutboxItems] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setAddress(currentOrg.address || "");
      setPhone(currentOrg.phone || "");
      setEmail(currentOrg.email || "");
    }
  }, [currentOrg]);

  const refreshOutbox = async () => {
    if (typeof window !== "undefined") {
      const items = await getAllOutboxItems();
      setOutboxItems(items);
    }
  };

  useEffect(() => {
    refreshOutbox();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) return;
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgName.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        })
        .eq("id", currentOrg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      toast.success("Organization profile updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile");
    },
  });

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncOutbox();
      await refreshOutbox();
      if (res.syncedCount > 0) {
        toast.success(`Successfully synchronized ${res.syncedCount} offline operations!`);
        queryClient.invalidateQueries();
      } else if (res.failedCount > 0) {
        toast.error(`Sync finished with ${res.failedCount} failures.`);
      } else {
        toast.info("Outbox is clean. All records are synchronized.");
      }
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearOutboxItem = async (id: string) => {
    await deleteOutboxItem(id);
    await refreshOutbox();
    toast.success("Outbox transaction discarded");
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          System Settings & Platform Architecture
        </h2>
        <p className="text-xs text-slate-500">
          Configure corporate workspace identity, verify Supabase backend health, and manage hybrid offline caching.
        </p>
      </div>

      {/* Organization Profile Settings */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Organization Profile
          </CardTitle>
          <CardDescription className="text-xs">
            Corporate entity displayed on official PDF report headers and barcode labels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Organization Name</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Official Support Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Corporate Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Headquarters Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button
            size="sm"
            onClick={() => updateOrgMutation.mutate()}
            disabled={updateOrgMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {updateOrgMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </CardFooter>
      </Card>

      {/* Hybrid PWA & Offline Outbox Status */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-indigo-600" />
                Hybrid PWA & Offline Synchronization Engine
              </CardTitle>
              <CardDescription className="text-xs">
                Cloud-first architecture with local IndexedDB outbox. Transactions made offline remain pending until validated by server RPC.
              </CardDescription>
            </div>
            <Badge
              variant={isOnline ? "success" : "warning"}
              className="gap-1.5 text-xs font-semibold px-2.5 py-1"
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" /> Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" /> Offline Mode
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border rounded-lg">
            <div>
              <div className="text-xs font-bold text-slate-800">
                IndexedDB Outbox Queue: {outboxItems.length} Pending Operations
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Operations waiting to be synchronized with Supabase PostgreSQL.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {outboxItems.length > 0 && (
            <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden">
              {outboxItems.map((item) => (
                <div key={item.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 capitalize font-mono">
                      {item.type.replace("_", " ")}
                    </span>
                    <span className="text-slate-400 text-[10px] ml-2 font-mono">
                      ID: {item.id.slice(0, 8)}...
                    </span>
                    {item.error_message && (
                      <div className="text-rose-600 text-[10px] mt-0.5">
                        Error: {item.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.status === "failed" ? "destructive" : "warning"}
                      className="text-[10px] uppercase"
                    >
                      {item.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                      onClick={() => handleClearOutboxItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supabase Connection Telemetry */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            Supabase PostgreSQL Backend Health
          </CardTitle>
          <CardDescription className="text-xs">
            Direct connection configuration, Row Level Security status, and RPC functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-slate-50 border rounded-lg flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-medium">Supabase Host URL: </span>
              <span className="font-mono font-semibold text-slate-800">
                {process.env.NEXT_PUBLIC_SUPABASE_URL || "Configured via environment variables"}
              </span>
            </div>
            <Badge variant="success" className="text-xs gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> RLS Enabled
            </Badge>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed">
            All transactional operations (Stock In, Stock Out, Stock Adjustment, Asset Assignment, Asset Return, Status Changes) are securely executed via atomic PostgreSQL RPC functions to ensure ledger immutability and prevent negative balances.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
