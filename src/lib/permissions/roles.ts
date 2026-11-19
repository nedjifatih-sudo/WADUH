import { UserRole } from "@/types";

export type AppPermission =
  | "org:manage"
  | "users:manage"
  | "products:create"
  | "products:edit"
  | "products:archive"
  | "stock:in"
  | "stock:out"
  | "stock:adjust"
  | "assets:create"
  | "assets:edit"
  | "assets:assign"
  | "assets:return"
  | "assets:maintain"
  | "assets:dispose"
  | "reports:view"
  | "reports:export"
  | "audit:view";

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  super_admin: [
    "org:manage",
    "users:manage",
    "products:create",
    "products:edit",
    "products:archive",
    "stock:in",
    "stock:out",
    "stock:adjust",
    "assets:create",
    "assets:edit",
    "assets:assign",
    "assets:return",
    "assets:maintain",
    "assets:dispose",
    "reports:view",
    "reports:export",
    "audit:view",
  ],
  admin: [
    "users:manage",
    "products:create",
    "products:edit",
    "products:archive",
    "stock:in",
    "stock:out",
    "stock:adjust",
    "assets:create",
    "assets:edit",
    "assets:assign",
    "assets:return",
    "assets:maintain",
    "assets:dispose",
    "reports:view",
    "reports:export",
    "audit:view",
  ],
  manager: [
    "stock:adjust",
    "reports:view",
    "reports:export",
    "audit:view",
  ],
  staff: [
    "products:create",
    "products:edit",
    "stock:in",
    "stock:out",
    "assets:create",
    "assets:assign",
    "assets:return",
    "assets:maintain",
    "reports:view",
  ],
  viewer: [
    "reports:view",
  ],
};

export function hasPermission(role: UserRole | null | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isAtLeastRole(userRole: UserRole | null | undefined, minimumRole: UserRole): boolean {
  if (!userRole) return false;
  const hierarchy: Record<UserRole, number> = {
    super_admin: 5,
    admin: 4,
    manager: 3,
    staff: 2,
    viewer: 1,
  };
  return hierarchy[userRole] >= hierarchy[minimumRole];
}
