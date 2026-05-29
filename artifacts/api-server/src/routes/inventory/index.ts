import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, inventoryItemsTable, warehousesTable, stockItemsTable } from "@workspace/db";
import {
  ListInventoryItemsQueryParams,
  CreateInventoryItemBody,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  DeleteInventoryItemParams,
  CreateWarehouseBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/inventory/warehouses", async (_req, res): Promise<void> => {
  const warehouses = await db.select().from(warehousesTable).orderBy(warehousesTable.name);
  res.json(warehouses);
});

router.post("/inventory/warehouses", async (req, res): Promise<void> => {
  const parsed = CreateWarehouseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [warehouse] = await db.insert(warehousesTable).values(parsed.data).returning();
  res.status(201).json(warehouse);
});

router.get("/inventory", async (req, res): Promise<void> => {
  const query = ListInventoryItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { warehouseId, search } = query.data;
  const conditions = [];
  if (warehouseId) conditions.push(eq(inventoryItemsTable.warehouseId, warehouseId));

  const rows = await db
    .select({
      id: inventoryItemsTable.id,
      stockItemId: inventoryItemsTable.stockItemId,
      warehouseId: inventoryItemsTable.warehouseId,
      quantity: inventoryItemsTable.quantity,
      batchNumber: inventoryItemsTable.batchNumber,
      expiryDate: inventoryItemsTable.expiryDate,
      notes: inventoryItemsTable.notes,
      createdAt: inventoryItemsTable.createdAt,
      updatedAt: inventoryItemsTable.updatedAt,
      stockItemName: stockItemsTable.name,
      warehouseName: warehousesTable.name,
    })
    .from(inventoryItemsTable)
    .leftJoin(stockItemsTable, eq(inventoryItemsTable.stockItemId, stockItemsTable.id))
    .leftJoin(warehousesTable, eq(inventoryItemsTable.warehouseId, warehousesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(inventoryItemsTable.createdAt);

  const result = search
    ? rows.filter((r) => {
        const s = String(search).toLowerCase();
        return (
          r.stockItemName?.toLowerCase().includes(s) ||
          r.warehouseName?.toLowerCase().includes(s) ||
          r.batchNumber?.toLowerCase().includes(s)
        );
      })
    : rows;

  res.json(result);
});

router.post("/inventory", async (req, res): Promise<void> => {
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(inventoryItemsTable).values(parsed.data).returning();

  const [enriched] = await db
    .select({
      id: inventoryItemsTable.id,
      stockItemId: inventoryItemsTable.stockItemId,
      warehouseId: inventoryItemsTable.warehouseId,
      quantity: inventoryItemsTable.quantity,
      batchNumber: inventoryItemsTable.batchNumber,
      expiryDate: inventoryItemsTable.expiryDate,
      notes: inventoryItemsTable.notes,
      createdAt: inventoryItemsTable.createdAt,
      updatedAt: inventoryItemsTable.updatedAt,
      stockItemName: stockItemsTable.name,
      warehouseName: warehousesTable.name,
    })
    .from(inventoryItemsTable)
    .leftJoin(stockItemsTable, eq(inventoryItemsTable.stockItemId, stockItemsTable.id))
    .leftJoin(warehousesTable, eq(inventoryItemsTable.warehouseId, warehousesTable.id))
    .where(eq(inventoryItemsTable.id, item.id));

  res.status(201).json(enriched);
});

router.patch("/inventory/:id", async (req, res): Promise<void> => {
  const params = UpdateInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db
    .update(inventoryItemsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(inventoryItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  res.json(item);
});

router.delete("/inventory/:id", async (req, res): Promise<void> => {
  const params = DeleteInventoryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .delete(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
