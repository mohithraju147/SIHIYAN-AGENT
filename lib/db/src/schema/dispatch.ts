import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dispatchesTable = pgTable("dispatches", {
  id: serial("id").primaryKey(),
  trackingNumber: text("tracking_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  destination: text("destination").notNull(),
  status: text("status").notNull().default("pending"),
  items: text("items").notNull(),
  totalWeight: numeric("total_weight", { precision: 12, scale: 3 }),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }),
  dispatchDate: timestamp("dispatch_date"),
  expectedDelivery: timestamp("expected_delivery"),
  deliveredAt: timestamp("delivered_at"),
  notes: text("notes"),
  driver: text("driver"),
  vehicle: text("vehicle"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDispatchSchema = createInsertSchema(dispatchesTable).omit({
  id: true,
  trackingNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDispatch = z.infer<typeof insertDispatchSchema>;
export type Dispatch = typeof dispatchesTable.$inferSelect;
