import { Router, type IRouter } from "express";
import { eq, lte, ilike, and, or } from "drizzle-orm";
import { db, stockItemsTable } from "@workspace/db";
import {
  ListStockItemsQueryParams,
  CreateStockItemBody,
  UpdateStockItemBody,
  GetStockItemParams,
  UpdateStockItemParams,
  DeleteStockItemParams,
  AdjustStockQuantityParams,
  AdjustStockQuantityBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stock", async (req, res): Promise<void> => {
  const query = ListStockItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { category, search, lowStock } = query.data;
  const conditions = [];

  if (category) conditions.push(eq(stockItemsTable.category, category));
  if (search) {
    conditions.push(
      or(
        ilike(stockItemsTable.name, `%${search}%`),
        ilike(stockItemsTable.sku, `%${search}%`)
      )
    );
  }
  if (lowStock === true) {
    conditions.push(lte(stockItemsTable.quantity, stockItemsTable.minQuantity));
  }

  const items = await db
    .select()
    .from(stockItemsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(stockItemsTable.name);

  res.json(items);
});

router.post("/stock", async (req, res): Promise<void> => {
  const parsed = CreateStockItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(stockItemsTable).values(parsed.data).returning();
  res.status(201).json(item);
});

router.get("/stock/summary", async (_req, res): Promise<void> => {
  const items = await db.select().from(stockItemsTable);

  const totalItems = items.length;
  const totalValue = items.reduce((sum, item) => {
    return sum + (parseFloat(String(item.quantity)) || 0) * (parseFloat(String(item.unitPrice ?? "0")) || 0);
  }, 0);
  const lowStockCount = items.filter(
    (i) => parseFloat(String(i.quantity)) <= parseFloat(String(i.minQuantity))
  ).length;
  const outOfStockCount = items.filter((i) => parseFloat(String(i.quantity)) === 0).length;
  const categoriesCount = new Set(items.map((i) => i.category)).size;

  res.json({ totalItems, totalValue, lowStockCount, outOfStockCount, categoriesCount });
});

router.get("/stock/categories", async (_req, res): Promise<void> => {
  const items = await db.select().from(stockItemsTable);
  const map: Record<string, { count: number; totalQuantity: number }> = {};

  for (const item of items) {
    if (!map[item.category]) map[item.category] = { count: 0, totalQuantity: 0 };
    map[item.category].count++;
    map[item.category].totalQuantity += parseFloat(String(item.quantity)) || 0;
  }

  res.json(
    Object.entries(map).map(([category, s]) => ({
      category,
      count: s.count,
      totalQuantity: s.totalQuantity,
    }))
  );
});

router.get("/stock/:id", async (req, res): Promise<void> => {
  const params = GetStockItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .select()
    .from(stockItemsTable)
    .where(eq(stockItemsTable.id, params.data.id));

  if (!item) {
    res.status(404).json({ error: "Stock item not found" });
    return;
  }

  res.json(item);
});

router.patch("/stock/:id", async (req, res): Promise<void> => {
  const params = UpdateStockItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStockItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .update(stockItemsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(stockItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Stock item not found" });
    return;
  }

  res.json(item);
});

router.delete("/stock/:id", async (req, res): Promise<void> => {
  const params = DeleteStockItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .delete(stockItemsTable)
    .where(eq(stockItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Stock item not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/stock/:id/adjust", async (req, res): Promise<void> => {
  const params = AdjustStockQuantityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdjustStockQuantityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(stockItemsTable)
    .where(eq(stockItemsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Stock item not found" });
    return;
  }

  const newQty = Math.max(0, (parseFloat(String(existing.quantity)) || 0) + Number(parsed.data.delta));

  const [item] = await db
    .update(stockItemsTable)
    .set({ quantity: String(newQty), updatedAt: new Date() })
    .where(eq(stockItemsTable.id, params.data.id))
    .returning();

  res.json(item);
});

export default router;
