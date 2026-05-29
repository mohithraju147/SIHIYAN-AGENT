import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const voiceCommands = pgTable("voice_commands", {
  id: serial("id").primaryKey(),
  transcript: text("transcript").notNull(),
  language: text("language").notNull().default("en-US"),
  action: text("action").notNull(),
  details: text("details"),
  success: boolean("success").notNull().default(true),
  resultMessage: text("result_message"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});
