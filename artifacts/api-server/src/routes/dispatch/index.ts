import { Router, type IRouter } from "express";
import { eq, ilike, gte, lte, and, or } from "drizzle-orm";
import { db, dispatchesTable } from "@workspace/db";
import {
  ListDispatchesQueryParams,
  CreateDispatchBody,
  UpdateDispatchBody,
  GetDispatchParams,
  UpdateDispatchParams,
  DeleteDispatchParams,
  UpdateDispatchStatusParams,
  UpdateDispatchStatusBody,
} from "@workspace/api-zod";

function generateTrackingNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `SHS${date}${rand}`;
}

const router: IRouter = Router();

router.get("/dispatch", async (req, res): Promise<void> => {
  const query = ListDispatchesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, search, dateFrom, dateTo } = query.data;
  const conditions = [];

  if (status) conditions.push(eq(dispatchesTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(dispatchesTable.trackingNumber, `%${search}%`),
        ilike(dispatchesTable.customerName, `%${search}%`),
        ilike(dispatchesTable.destination, `%${search}%`)
      )
    );
  }
  if (dateFrom) conditions.push(gte(dispatchesTable.createdAt, new Date(String(dateFrom))));
  if (dateTo) conditions.push(lte(dispatchesTable.createdAt, new Date(String(dateTo))));

  const dispatches = await db
    .select()
    .from(dispatchesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(dispatchesTable.createdAt);

  res.json(dispatches);
});

router.post("/dispatch", async (req, res): Promise<void> => {
  const parsed = CreateDispatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dispatch] = await db
    .insert(dispatchesTable)
    .values({ ...parsed.data, trackingNumber: generateTrackingNumber() })
    .returning();

  res.status(201).json(dispatch);
});

router.get("/dispatch/summary", async (_req, res): Promise<void> => {
  const all = await db.select().from(dispatchesTable);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  res.json({
    total: all.length,
    pending: all.filter((d) => d.status === "pending").length,
    inTransit: all.filter((d) => d.status === "in_transit").length,
    delivered: all.filter((d) => d.status === "delivered").length,
    cancelled: all.filter((d) => d.status === "cancelled").length,
    todayDispatches: all.filter((d) => new Date(d.createdAt) >= today).length,
    totalValueInTransit: all
      .filter((d) => d.status === "in_transit")
      .reduce((s, d) => s + (parseFloat(String(d.totalValue ?? "0")) || 0), 0),
  });
});

router.get("/dispatch/recent", async (_req, res): Promise<void> => {
  const dispatches = await db
    .select()
    .from(dispatchesTable)
    .orderBy(dispatchesTable.createdAt)
    .limit(10);

  res.json(dispatches);
});

router.get("/dispatch/:id", async (req, res): Promise<void> => {
  const params = GetDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dispatch] = await db
    .select()
    .from(dispatchesTable)
    .where(eq(dispatchesTable.id, params.data.id));

  if (!dispatch) {
    res.status(404).json({ error: "Dispatch not found" });
    return;
  }

  res.json(dispatch);
});

router.patch("/dispatch/:id", async (req, res): Promise<void> => {
  const params = UpdateDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDispatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dispatch] = await db
    .update(dispatchesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(dispatchesTable.id, params.data.id))
    .returning();

  if (!dispatch) {
    res.status(404).json({ error: "Dispatch not found" });
    return;
  }

  res.json(dispatch);
});

router.delete("/dispatch/:id", async (req, res): Promise<void> => {
  const params = DeleteDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dispatch] = await db
    .delete(dispatchesTable)
    .where(eq(dispatchesTable.id, params.data.id))
    .returning();

  if (!dispatch) {
    res.status(404).json({ error: "Dispatch not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/dispatch/:id/status", async (req, res): Promise<void> => {
  const params = UpdateDispatchStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDispatchStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    status: parsed.data.status,
    updatedAt: new Date(),
  };
  if (parsed.data.notes) updateData.notes = parsed.data.notes;
  if (parsed.data.status === "delivered") updateData.deliveredAt = new Date();

  const [dispatch] = await db
    .update(dispatchesTable)
    .set(updateData)
    .where(eq(dispatchesTable.id, params.data.id))
    .returning();

  if (!dispatch) {
    res.status(404).json({ error: "Dispatch not found" });
    return;
  }

  res.json(dispatch);
});

export default router;
