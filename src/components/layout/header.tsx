"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
  Camera,
  Building2,
  ChevronDown,
  LogOut,
  User,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { ScannerModal } from "@/components/barcode/scanner-modal";
import { syncOutbox } from "@/lib/offline/sync";
import { toast } from "sonner";

export function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const { user, profile, currentOrg, currentRole, memberships, switchOrganization, signOut } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  // Format breadcrumb text from current path
  const pathSegments = pathname.split("/").filter(Boolean);
  const currentTitle = pathSegments.length > 0
    ? pathSegments[0].charAt(0).toUpperCase() + pathSegments[0].slice(1).replace("-", " ")
    : "Dashboard";

  const handleSyncOutbox = async () => {
    setIsSyncing(true);
    try {
      const res = await syncOutbox();
      if (res.syncedCount > 0) {
        toast.success(`Successfully synchronized ${res.syncedCount} offline transactions!`);
      } else if (res.failedCount > 0) {
        toast.error(`Sync finished with ${res.failedCount} failures.`);
      } else {
        toast.info("All transactions are up to date.");
      }
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <header className="h-16 border-b bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Mobile Menu Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 text-slate-500"
              onClick={onMenuToggle}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          )}

          <div className="flex flex-col">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <span>INVENTORY OS</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300 font-semibold">{currentTitle}</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              {currentTitle}
            </h1>
          </div>
        </div>

        {/* Right Action Icons & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Scanner Icon Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScannerOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100"
          >
            <Camera className="h-3.5 w-3.5 text-blue-600" />
            <span>Scan Code</span>
          </Button>

          {/* Sync / Offline Status Icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSyncOutbox}
            disabled={isSyncing}
            title={isOnline ? "Online - Click to sync offline outbox" : "Offline mode active"}
            className="h-8 w-8 text-slate-500 hover:text-slate-900"
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            ) : isOnline ? (
              <Wifi className="h-4 w-4 text-emerald-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-600" />
            )}
          </Button>

          {/* Organization Selector */}
          {memberships.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden lg:flex items-center gap-1.5 h-8 text-xs">
                  <Building2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="max-w-[120px] truncate">{currentOrg?.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.organization_id}
                    onClick={() => switchOrganization(m.organization_id)}
                    className="text-xs flex items-center justify-between"
                  >
                    <span>{m.organization.name}</span>
                    <span className="text-[10px] text-slate-400 capitalize">{m.role}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
                <Avatar className="h-8 w-8 border">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="bg-blue-600 text-white font-semibold">
                    {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-xs font-semibold leading-none">{profile?.full_name || "User"}</p>
                <p className="text-[11px] leading-none text-muted-foreground">{profile?.email}</p>
                <div className="mt-1 pt-1 border-t text-[10px] text-blue-600 font-medium uppercase tracking-wider">
                  Role: {currentRole?.replace("_", " ")}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => (window.location.href = "/settings")} className="text-xs gap-2">
                <User className="h-3.5 w-3.5" />
                Settings & Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (window.location.href = "/audit-logs")} className="text-xs gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit Trail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-xs gap-2 text-rose-600 focus:text-rose-600">
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Barcode Scanner Modal */}
      <ScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} />
    </>
  );
}
