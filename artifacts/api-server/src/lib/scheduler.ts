import { schedule } from "node-cron";
import { db, dailyReportsTable, stockItemsTable, dispatchesTable, systemSettings } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { eq } from "drizzle-orm";
import { sendSlackMessage, formatReportForSlack } from "./slack";
import { logger } from "./logger";

async function generateAndSendDailyReport(): Promise<void> {
  logger.info("Scheduler: generating daily report");

  const [stocks, dispatches] = await Promise.all([
    db.select().from(stockItemsTable),
    db.select().from(dispatchesTable),
  ]);

  const lowStock = stocks.filter(
    (s) => parseFloat(String(s.quantity)) <= parseFloat(String(s.minQuantity))
  );
  const totalValue = stocks.reduce(
    (s, i) => s + (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unitPrice ?? "0")) || 0),
    0
  );

  const prompt = `You are an AI assistant for SIHI Seeds. Generate a daily operations report as valid JSON with these exact keys: summary, stockInsights, dispatchInsights, recommendations.

Data:
- Stock items: ${stocks.length}, Low stock: ${lowStock.length} (${lowStock.map((s) => s.name).join(", ") || "none"})
- Total stock value: ₹${totalValue.toFixed(2)}
- Dispatches: total=${dispatches.length}, pending=${dispatches.filter((d) => d.status === "pending").length}, in_transit=${dispatches.filter((d) => d.status === "in_transit").length}, delivered=${dispatches.filter((d) => d.status === "delivered").length}

Respond ONLY with valid JSON, no markdown, no extra text.`;

  let summary = `Scheduled daily report - ${new Date().toLocaleDateString("en-IN")}`;
  let stockInsights: string | null = null;
  let dispatchInsights: string | null = null;
  let recommendations: string | null = null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text ?? "{}");
    summary = String(parsed.summary ?? summary);
    stockInsights = parsed.stockInsights ? String(parsed.stockInsights) : null;
    dispatchInsights = parsed.dispatchInsights ? String(parsed.dispatchInsights) : null;
    recommendations = parsed.recommendations ? String(parsed.recommendations) : null;
  } catch (err) {
    logger.warn({ err }, "Scheduler: Gemini report generation failed, using fallback");
  }

  const [report] = await db
    .insert(dailyReportsTable)
    .values({ reportDate: new Date(), summary, stockInsights, dispatchInsights, recommendations, generatedBy: "gemini-2.5-flash (scheduled)" })
    .returning();

  // Read Slack webhook from DB settings (fallback to env var)
  let webhookUrl = process.env.SLACK_WEBHOOK;
  try {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, "slack_webhook"));
    if (setting?.value) webhookUrl = setting.value;
  } catch {
    // use env var
  }

  if (webhookUrl) {
    await sendSlackMessage(formatReportForSlack(report));
    logger.info("Scheduler: daily report sent to Slack");
  } else {
    logger.info("Scheduler: no Slack webhook configured, skipping notification");
  }
}

export function initScheduler(): void {
  // Read schedule time from environment (default: 8:00 AM IST = 2:30 UTC)
  const cronExpr = process.env.REPORT_CRON ?? "30 2 * * *";

  try {
    schedule(cronExpr, () => {
      generateAndSendDailyReport().catch((err) =>
        logger.error({ err }, "Scheduler: daily report failed")
      );
    });
    logger.info({ cron: cronExpr }, "Daily report scheduler started");
  } catch (err) {
    logger.warn({ err }, "Scheduler: invalid cron expression, scheduler not started");
  }
}
