"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  History,
  QrCode,
  UserCheck,
  Wrench,
  ShieldAlert,
  Users,
  Truck,
  Warehouse,
  MapPin,
  BarChart3,
  ScrollText,
  UserCog,
  Settings,
  Box,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: any;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    section: "OVERVIEW",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "INVENTORY",
    items: [
      { title: "Products", href: "/products", icon: Package },
      { title: "Categories", href: "/categories", icon: Layers },
      { title: "Stock Overview", href: "/inventory", icon: Boxes },
      { title: "Stock In", href: "/stock/in", icon: ArrowDownToLine },
      { title: "Stock Out", href: "/stock/out", icon: ArrowUpFromLine },
      { title: "Stock Adjustments", href: "/stock/adjustments", icon: SlidersHorizontal },
      { title: "Stock Movements", href: "/stock/movements", icon: History },
    ],
  },
  {
    section: "ASSETS",
    items: [
      { title: "Asset Register", href: "/assets", icon: QrCode },
      { title: "Asset Assignment", href: "/assignments", icon: UserCheck },
      { title: "Asset Maintenance", href: "/maintenance", icon: Wrench },
      { title: "Asset Warranty", href: "/warranty", icon: ShieldAlert },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      { title: "Employees", href: "/employees", icon: Users },
      { title: "Suppliers", href: "/suppliers", icon: Truck },
      { title: "Warehouses", href: "/warehouses", icon: Warehouse },
      { title: "Locations", href: "/locations", icon: MapPin },
    ],
  },
  {
    section: "ANALYTICS",
    items: [
      { title: "Reports", href: "/reports", icon: BarChart3 },
      { title: "Audit Logs", href: "/audit-logs", icon: ScrollText },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { title: "Users & Roles", href: "/users", icon: UserCog },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { currentOrg, currentRole } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 bg-[#111827] text-slate-300 border-r border-slate-800 h-screen sticky top-0 select-none z-30",
        className
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
          <Box className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-white text-base leading-none">
            INVENTORY OS
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-wider mt-1 uppercase">
            {currentOrg?.name || "Enterprise"}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((group) => (
          <div key={group.section} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-500 tracking-wider">
              {group.section}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all group",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                    )}
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Role Badge */}
      <div className="p-3 border-t border-slate-800 bg-[#0c121d]">
        <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1">
          <span className="text-[11px]">Role:</span>
          <span className="font-semibold text-blue-400 uppercase text-[10px] bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded">
            {currentRole?.replace("_", " ") || "Admin"}
          </span>
        </div>
      </div>
    </aside>
  );
}
