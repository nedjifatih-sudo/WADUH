import { createClient } from "@/lib/supabase/client";
import {
  getAllOutboxItems,
  updateOutboxItemStatus,
  deleteOutboxItem,
  OutboxItem,
} from "./idb";

export async function syncOutbox(): Promise<{
  syncedCount: number;
  failedCount: number;
  errors: string[];
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, errors: ["Offline"] };
  }

  const items = await getAllOutboxItems();
  const pendingItems = items.filter((i) => i.status === "pending" || i.status === "failed");

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const supabase = createClient();

  for (const item of pendingItems) {
    try {
      await updateOutboxItemStatus(item.id, "syncing");

      let error: any = null;

      if (item.type === "stock_in") {
        const { data, error: rpcError } = await (supabase.rpc as any)("process_stock_in", {
          p_org_id: item.payload.organization_id,
          p_product_id: item.payload.product_id,
          p_warehouse_id: item.payload.warehouse_id,
          p_quantity: item.payload.quantity,
          p_supplier_id: item.payload.supplier_id || null,
          p_reference_number: item.payload.reference_number || null,
          p_notes: item.payload.notes || null,
          p_idempotency_key: item.id, // Idempotency prevents duplicates
        });
        error = rpcError;
      } else if (item.type === "stock_out") {
        const { data, error: rpcError } = await (supabase.rpc as any)("process_stock_out", {
          p_org_id: item.payload.organization_id,
          p_product_id: item.payload.product_id,
          p_warehouse_id: item.payload.warehouse_id,
          p_quantity: item.payload.quantity,
          p_purpose: item.payload.purpose || null,
          p_reference_number: item.payload.reference_number || null,
          p_notes: item.payload.notes || null,
          p_idempotency_key: item.id,
        });
        error = rpcError;
      } else if (item.type === "stock_adjustment") {
        const { data, error: rpcError } = await (supabase.rpc as any)("process_stock_adjustment", {
          p_org_id: item.payload.organization_id,
          p_product_id: item.payload.product_id,
          p_warehouse_id: item.payload.warehouse_id,
          p_direction: item.payload.direction,
          p_quantity: item.payload.quantity,
          p_reason: item.payload.reason,
          p_reference_number: item.payload.reference_number || null,
          p_idempotency_key: item.id,
        });
        error = rpcError;
      } else if (item.type === "asset_assignment") {
        const { data, error: rpcError } = await (supabase.rpc as any)("process_asset_assignment", {
          p_org_id: item.payload.organization_id,
          p_asset_id: item.payload.asset_id,
          p_employee_id: item.payload.employee_id,
          p_assigned_at: item.payload.assigned_at,
          p_expected_return_date: item.payload.expected_return_date || null,
          p_notes: item.payload.assignment_notes || null,
        });
        error = rpcError;
      } else if (item.type === "asset_return") {
        const { data, error: rpcError } = await (supabase.rpc as any)("process_asset_return", {
          p_org_id: item.payload.organization_id,
          p_asset_id: item.payload.asset_id,
          p_returned_condition: item.payload.returned_condition,
          p_returned_notes: item.payload.returned_notes || null,
          p_returned_at: item.payload.returned_at,
        });
        error = rpcError;
      }

      if (error) {
        throw new Error(error.message || "RPC execution failed");
      }

      await updateOutboxItemStatus(item.id, "synced");
      syncedCount++;
    } catch (err: any) {
      failedCount++;
      const msg = err.message || "Sync failed";
      errors.push(`Item ${item.id} (${item.type}): ${msg}`);
      await updateOutboxItemStatus(item.id, "failed", msg);
    }
  }

  return { syncedCount, failedCount, errors };
}
