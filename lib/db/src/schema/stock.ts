import { pgTable, serial, text, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stockItemsTable = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sku: text("sku").notNull().unique(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unit: text("unit").notNull(),
  minQuantity: numeric("min_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  maxQuantity: numeric("max_quantity", { precision: 12, scale: 3 }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  supplier: text("supplier"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStockItemSchema = createInsertSchema(stockItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItemsTable.$inferSelect;
