import { describe, it } from "node:test";
import assert from "node:assert";

// Simulation of the PostgreSQL RPC process_stock_out
function simulateProcessStockOut(currentBalance, requestQuantity, idempotencyKey, ledgerCache) {
  if (idempotencyKey && ledgerCache.has(idempotencyKey)) {
    return {
      success: true,
      balance_after: ledgerCache.get(idempotencyKey).balance_after,
      is_idempotent_replay: true,
    };
  }

  if (requestQuantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  if (currentBalance < requestQuantity) {
    throw new Error(`Insufficient stock. Current stock is ${currentBalance}, requested ${requestQuantity}`);
  }

  const balance_after = currentBalance - requestQuantity;
  if (idempotencyKey) {
    ledgerCache.set(idempotencyKey, { balance_after });
  }

  return {
    success: true,
    balance_after,
    is_idempotent_replay: false,
  };
}

// Simulation of Asset State Machine
class AssetLifecycleSimulator {
  constructor() {
    this.status = "available";
    this.activeAssignment = null;
  }

  assign(employeeId) {
    if (this.status !== "available") {
      throw new Error(`Asset is not available for assignment. Current status: ${this.status}`);
    }
    if (this.activeAssignment) {
      throw new Error("Asset already has an active assignment");
    }
    this.status = "assigned";
    this.activeAssignment = { employeeId, assignedAt: new Date() };
    return { success: true, status: this.status };
  }

  returnAsset(condition) {
    if (this.status !== "assigned" || !this.activeAssignment) {
      throw new Error("Cannot return asset that has no active assignment");
    }
    this.activeAssignment = null;
    this.status = condition === "damaged" ? "damaged" : "available";
    return { success: true, status: this.status };
  }

  changeStatus(newStatus) {
    if (this.status === "assigned" && newStatus !== "assigned") {
      throw new Error("Cannot modify or dispose an actively assigned asset. Please return the asset first.");
    }
    this.status = newStatus;
    return { success: true, status: this.status };
  }
}

describe("Core Business Logic & Invariant Enforcement", () => {
  it("Prevents stock from becoming negative", () => {
    const currentBalance = 10;
    const ledger = new Map();

    // Requesting 15 should throw an insufficient stock error
    assert.throws(
      () => simulateProcessStockOut(currentBalance, 15, "key-1", ledger),
      /Insufficient stock/
    );
  });

  it("Enforces idempotency keys: duplicate RPC requests return idempotent replay without double decrement", () => {
    let currentBalance = 50;
    const ledger = new Map();
    const key = "550e8400-e29b-41d4-a716-446655440000";

    // 1st request
    const firstCall = simulateProcessStockOut(currentBalance, 10, key, ledger);
    assert.strictEqual(firstCall.balance_after, 40);
    assert.strictEqual(firstCall.is_idempotent_replay, false);
    currentBalance = firstCall.balance_after;

    // 2nd request (network retry with identical idempotency key)
    const secondCall = simulateProcessStockOut(currentBalance, 10, key, ledger);
    assert.strictEqual(secondCall.balance_after, 40); // balance remains 40, not 30!
    assert.strictEqual(secondCall.is_idempotent_replay, true);
  });

  it("Asset Assignment Workflow: cannot double-assign", () => {
    const asset = new AssetLifecycleSimulator();
    assert.strictEqual(asset.status, "available");

    asset.assign("emp-01");
    assert.strictEqual(asset.status, "assigned");

    // Second assignment should fail
    assert.throws(() => asset.assign("emp-02"), /not available/);
  });

  it("Asset Return Workflow: cannot return unassigned asset", () => {
    const asset = new AssetLifecycleSimulator();
    assert.throws(() => asset.returnAsset("good"), /Cannot return/);
  });

  it("Asset Disposal Protection: cannot dispose actively assigned asset", () => {
    const asset = new AssetLifecycleSimulator();
    asset.assign("emp-01");

    assert.throws(
      () => asset.changeStatus("disposed"),
      /Cannot modify or dispose an actively assigned asset/
    );

    // Return first, then dispose
    asset.returnAsset("good");
    asset.changeStatus("disposed");
    assert.strictEqual(asset.status, "disposed");
  });
});
