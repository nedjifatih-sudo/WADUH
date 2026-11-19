import { describe, it } from "node:test";
import assert from "node:assert";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(2),
  purchase_price: z.number().min(0),
  min_stock: z.number().int().min(0),
});

const stockInSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const stockOutSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  purpose: z.string().min(2),
});

const stockAdjustmentSchema = z.object({
  direction: z.enum(["in", "out"]),
  quantity: z.number().int().min(1),
  reason: z.string().min(5),
});

describe("Entity Validations & Constraints", () => {
  it("Rejects negative purchase prices and negative minimum stock", () => {
    const invalidProduct = {
      name: "Toner",
      sku: "SKU-TON-01",
      purchase_price: -10,
      min_stock: -1,
    };
    const res = productSchema.safeParse(invalidProduct);
    assert.strictEqual(res.success, false);
  });

  it("Accepts valid product definitions", () => {
    const validProduct = {
      name: "MacBook Pro 16",
      sku: "SKU-IT-001",
      purchase_price: 3499.0,
      min_stock: 2,
    };
    const res = productSchema.safeParse(validProduct);
    assert.strictEqual(res.success, true);
  });

  it("Rejects zero or negative stock-in quantity", () => {
    const invalidStockIn = {
      product_id: "11111111-1111-1111-1111-111111111111",
      warehouse_id: "22222222-2222-2222-2222-222222222222",
      quantity: 0,
    };
    assert.strictEqual(stockInSchema.safeParse(invalidStockIn).success, false);
  });

  it("Enforces mandatory purpose on stock-out", () => {
    const stockOutMissingPurpose = {
      product_id: "11111111-1111-1111-1111-111111111111",
      warehouse_id: "22222222-2222-2222-2222-222222222222",
      quantity: 5,
      purpose: "",
    };
    assert.strictEqual(stockOutSchema.safeParse(stockOutMissingPurpose).success, false);
  });

  it("Enforces mandatory reason with minimum 5 characters on stock adjustments", () => {
    const adjustmentShortReason = {
      direction: "out",
      quantity: 2,
      reason: "bad", // only 3 chars
    };
    assert.strictEqual(stockAdjustmentSchema.safeParse(adjustmentShortReason).success, false);

    const validAdjustment = {
      direction: "out",
      quantity: 2,
      reason: "Water damage observed during quarterly audit",
    };
    assert.strictEqual(stockAdjustmentSchema.safeParse(validAdjustment).success, true);
  });
});
