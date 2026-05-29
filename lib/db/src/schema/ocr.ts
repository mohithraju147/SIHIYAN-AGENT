import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scannedBillsTable = pgTable("scanned_bills", {
  id: serial("id").primaryKey(),
  rawText: text("raw_text").notNull(),
  parsedData: text("parsed_data"),
  billType: text("bill_type"),
  vendorName: text("vendor_name"),
  billAmount: numeric("bill_amount", { precision: 12, scale: 2 }),
  billDate: timestamp("bill_date"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScannedBillSchema = createInsertSchema(scannedBillsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertScannedBill = z.infer<typeof insertScannedBillSchema>;
export type ScannedBill = typeof scannedBillsTable.$inferSelect;
