import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dailyReportsTable } from "@workspace/db";
import { GetDailyReportParams } from "@workspace/api-zod";
import { sendSlackMessage, formatReportForSlack } from "../../lib/slack";
import { generateDailyReport } from "../../lib/report-generator";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/reports/daily", async (_req, res): Promise<void> => {
  const reports = await db.select().from(dailyReportsTable).orderBy(dailyReportsTable.reportDate);
  res.json(reports);
});

router.post("/reports/daily", async (_req, res): Promise<void> => {
  const report = await generateDailyReport({ sendSlack: true });
  res.status(201).json(report);
});

router.get("/reports/daily/:id", async (req, res): Promise<void> => {
  const params = GetDailyReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.id, params.data.id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(report);
});

router.post("/reports/daily/:id/send-slack", async (req, res): Promise<void> => {
  const params = GetDailyReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db.select().from(dailyReportsTable).where(eq(dailyReportsTable.id, params.data.id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  await sendSlackMessage(formatReportForSlack(report));
  res.json({ ok: true });
});

export default router;
