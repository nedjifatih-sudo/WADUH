import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface OutboxItem {
  id: string; // client uuid (also used as idempotency key)
  type: "stock_in" | "stock_out" | "stock_adjustment" | "asset_assignment" | "asset_return";
  payload: any;
  created_at: string;
  status: "pending" | "syncing" | "synced" | "failed";
  retry_count: number;
  error_message?: string;
}

interface InventoryOSDB extends DBSchema {
  products_cache: {
    key: string;
    value: any;
  };
  assets_cache: {
    key: string;
    value: any;
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { "by-status": string };
  };
}

const DB_NAME = "inventory_os_offline_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InventoryOSDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<InventoryOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products_cache")) {
          db.createObjectStore("products_cache", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("assets_cache")) {
          db.createObjectStore("assets_cache", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
          outboxStore.createIndex("by-status", "status");
        }
      },
    });
  }
  return dbPromise;
}

// Cache helpers
export async function cacheProducts(products: any[]) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction("products_cache", "readwrite");
  for (const item of products) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function getCachedProducts(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("products_cache");
}

export async function cacheAssets(assets: any[]) {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction("assets_cache", "readwrite");
  for (const item of assets) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function getCachedAssets(): Promise<any[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("assets_cache");
}

// Outbox helpers
export async function queueOfflineOperation(
  type: OutboxItem["type"],
  payload: any
): Promise<OutboxItem> {
  const db = await getDB();
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    type,
    payload,
    created_at: new Date().toISOString(),
    status: "pending",
    retry_count: 0,
  };
  if (db) {
    await db.put("outbox", item);
  }
  return item;
}

export async function getPendingOutboxItems(): Promise<OutboxItem[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAllFromIndex("outbox", "by-status", "pending");
}

export async function getAllOutboxItems(): Promise<OutboxItem[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("outbox");
}

export async function updateOutboxItemStatus(
  id: string,
  status: OutboxItem["status"],
  error_message?: string
) {
  const db = await getDB();
  if (!db) return;
  const item = await db.get("outbox", id);
  if (item) {
    item.status = status;
    if (error_message) item.error_message = error_message;
    if (status === "syncing") item.retry_count += 1;
    await db.put("outbox", item);
  }
}

export async function deleteOutboxItem(id: string) {
  const db = await getDB();
  if (!db) return;
  await db.delete("outbox", id);
}
