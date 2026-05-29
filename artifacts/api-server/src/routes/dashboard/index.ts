import { Router, type IRouter } from "express";
import { gte } from "drizzle-orm";
import { db, stockItemsTable, dispatchesTable, scannedBillsTable, dailyReportsTable } from "@workspace/db";
import { GetDashboardTrendsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/overview", async (_req, res): Promise<void> => {
  const [stocks, dispatches, bills, reports] = await Promise.all([
    db.select().from(stockItemsTable),
    db.select().from(dispatchesTable),
    db.select().from(scannedBillsTable),
    db.select().from(dailyReportsTable).limit(1),
  ]);

  const totalStockItems = stocks.length;
  const lowStockAlerts = stocks.filter(
    (s) => parseFloat(String(s.quantity)) <= parseFloat(String(s.minQuantity))
  ).length;
  const activeDispatches = dispatches.filter((d) =>
    ["pending", "in_transit"].includes(d.status)
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDispatches = dispatches.filter((d) => new Date(d.createdAt) >= today).length;
  const totalInventoryValue = stocks.reduce((sum, s) => {
    return sum + (parseFloat(String(s.quantity)) || 0) * (parseFloat(String(s.unitPrice ?? "0")) || 0);
  }, 0);

  res.json({
    totalStockItems,
    lowStockAlerts,
    activeDispatches,
    todayDispatches,
    totalInventoryValue,
    pendingBills: bills.length,
    recentReportDate: reports[0]?.reportDate?.toISOString() ?? null,
  });
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const [recentDispatches, recentStocks] = await Promise.all([
    db.select().from(dispatchesTable).orderBy(dispatchesTable.createdAt).limit(5),
    db.select().from(stockItemsTable).orderBy(stockItemsTable.updatedAt).limit(5),
  ]);

  const activities: { id: string; type: string; description: string; timestamp: string; metadata: string | null }[] = [];

  for (const d of recentDispatches) {
    activities.push({
      id: `dispatch-${d.id}`,
      type: "dispatch",
      description: `Dispatch ${d.trackingNumber} created for ${d.customerName}`,
      timestamp: d.createdAt.toISOString(),
      metadata: JSON.stringify({ status: d.status, destination: d.destination }),
    });
  }

  for (const s of recentStocks) {
    activities.push({
      id: `stock-${s.id}`,
      type: "stock",
      description: `Stock item "${s.name}" updated`,
      timestamp: s.updatedAt.toISOString(),
      metadata: JSON.stringify({ quantity: s.quantity, unit: s.unit }),
    });
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(activities.slice(0, 10));
});

router.get("/dashboard/trends", async (req, res): Promise<void> => {
  const params = GetDashboardTrendsQueryParams.safeParse(req.query);
  const days = params.success && params.data.days ? params.data.days : 7;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [dispatches, stocks] = await Promise.all([
    db.select().from(dispatchesTable).where(gte(dispatchesTable.createdAt, cutoff)),
    db.select().from(stockItemsTable),
  ]);

  const stockValue = stocks.reduce((sum, s) => {
    return sum + (parseFloat(String(s.quantity)) || 0) * (parseFloat(String(s.unitPrice ?? "0")) || 0);
  }, 0);

  const stockTrend: { date: string; value: number }[] = [];
  const dispatchTrend: { date: string; value: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);

    const count = dispatches.filter((dp) => {
      const c = new Date(dp.createdAt);
      return c >= dayStart && c <= dayEnd;
    }).length;

    dispatchTrend.push({ date: dateStr, value: count });
    stockTrend.push({ date: dateStr, value: Math.round(stockValue) });
  }

  res.json({ stockTrend, dispatchTrend });
});

export default router;
