import { describe, it } from "node:test";
import assert from "node:assert";

// Permission matrix definition
const ROLE_PERMISSIONS = {
  super_admin: [
    "org:manage", "users:manage", "products:create", "products:edit",
    "products:archive", "stock:in", "stock:out", "stock:adjust",
    "assets:create", "assets:edit", "assets:assign", "assets:return",
    "assets:maintain", "assets:dispose", "reports:view", "reports:export", "audit:view"
  ],
  admin: [
    "users:manage", "products:create", "products:edit", "products:archive",
    "stock:in", "stock:out", "stock:adjust", "assets:create", "assets:edit",
    "assets:assign", "assets:return", "assets:maintain", "assets:dispose",
    "reports:view", "reports:export", "audit:view"
  ],
  manager: [
    "stock:adjust", "reports:view", "reports:export", "audit:view"
  ],
  staff: [
    "products:create", "products:edit", "stock:in", "stock:out",
    "assets:create", "assets:assign", "assets:return", "assets:maintain", "reports:view"
  ],
  viewer: [
    "reports:view"
  ]
};

function hasPermission(role, perm) {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

describe("Role-Based Access Control (RBAC) Tests", () => {
  it("Super Admin has full system capabilities", () => {
    assert.strictEqual(hasPermission("super_admin", "org:manage"), true);
    assert.strictEqual(hasPermission("super_admin", "stock:in"), true);
    assert.strictEqual(hasPermission("super_admin", "assets:dispose"), true);
  });

  it("Staff can perform standard stock operations but cannot manage organizations or dispose assets", () => {
    assert.strictEqual(hasPermission("staff", "stock:in"), true);
    assert.strictEqual(hasPermission("staff", "stock:out"), true);
    assert.strictEqual(hasPermission("staff", "assets:assign"), true);
    assert.strictEqual(hasPermission("staff", "org:manage"), false);
    assert.strictEqual(hasPermission("staff", "assets:dispose"), false);
  });

  it("Manager can authorize stock adjustments and inspect audit logs, but cannot register products", () => {
    assert.strictEqual(hasPermission("manager", "stock:adjust"), true);
    assert.strictEqual(hasPermission("manager", "audit:view"), true);
    assert.strictEqual(hasPermission("manager", "products:create"), false);
  });

  it("Viewer has strictly read-only access", () => {
    assert.strictEqual(hasPermission("viewer", "reports:view"), true);
    assert.strictEqual(hasPermission("viewer", "stock:in"), false);
    assert.strictEqual(hasPermission("viewer", "assets:assign"), false);
    assert.strictEqual(hasPermission("viewer", "products:create"), false);
  });
});
