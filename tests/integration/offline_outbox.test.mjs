import { describe, it } from "node:test";
import assert from "node:assert";

class OutboxQueueSimulator {
  constructor() {
    this.items = [];
  }

  enqueue(type, payload) {
    const item = {
      id: "outbox-" + Math.random().toString(36).substring(7),
      type,
      payload,
      status: "pending",
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.items.push(item);
    return item;
  }

  async processSync(mockServerRpc) {
    let synced = 0;
    let failed = 0;

    for (const item of this.items) {
      if (item.status === "pending" || item.status === "failed") {
        item.status = "syncing";
        item.retryCount += 1;
        try {
          await mockServerRpc(item.type, item.payload, item.id);
          item.status = "synced";
          synced++;
        } catch (err) {
          item.status = "failed";
          item.errorMessage = err.message;
          failed++;
        }
      }
    }
    return { synced, failed };
  }
}

describe("Offline Outbox Queue & Sync Engine", () => {
  it("Queues transactions locally while offline with pending status", () => {
    const outbox = new OutboxQueueSimulator();
    const item = outbox.enqueue("stock_in", { product_id: "p1", quantity: 10 });
    assert.strictEqual(item.status, "pending");
    assert.strictEqual(outbox.items.length, 1);
  });

  it("Synchronizes queued operations sequentially when network returns", async () => {
    const outbox = new OutboxQueueSimulator();
    outbox.enqueue("stock_in", { product_id: "p1", quantity: 10 });
    outbox.enqueue("stock_out", { product_id: "p1", quantity: 2 });

    const serverCalls = [];
    const mockRpc = async (type, payload, idempotencyKey) => {
      serverCalls.push({ type, payload, idempotencyKey });
    };

    const res = await outbox.processSync(mockRpc);
    assert.strictEqual(res.synced, 2);
    assert.strictEqual(res.failed, 0);
    assert.strictEqual(serverCalls.length, 2);
    assert.strictEqual(outbox.items.every((i) => i.status === "synced"), true);
  });

  it("Marks failed operations gracefully without crashing outbox", async () => {
    const outbox = new OutboxQueueSimulator();
    outbox.enqueue("stock_out", { product_id: "p1", quantity: 999999 });

    const mockRpc = async () => {
      throw new Error("Insufficient stock on server");
    };

    const res = await outbox.processSync(mockRpc);
    assert.strictEqual(res.synced, 0);
    assert.strictEqual(res.failed, 1);
    assert.strictEqual(outbox.items[0].status, "failed");
    assert.strictEqual(outbox.items[0].errorMessage, "Insufficient stock on server");
  });
});
