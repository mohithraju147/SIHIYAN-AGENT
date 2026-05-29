import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyReportsTable = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  reportDate: timestamp("report_date").notNull().defaultNow(),
  summary: text("summary").notNull(),
  stockInsights: text("stock_insights"),
  dispatchInsights: text("dispatch_insights"),
  recommendations: text("recommendations"),
  generatedBy: text("generated_by").notNull().default("gemini-2.5-flash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReportsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDailyReport = z.infer<typeof insertDailyReportSchema>;
export type DailyReport = typeof dailyReportsTable.$inferSelect;
