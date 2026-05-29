import { Router, type IRouter } from "express";
import { db, systemSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(systemSettings);
  const map: Record<string, string | null> = {};
  for (const row of rows) map[row.key] = row.value;
  res.json(map);
});

router.patch("/settings", async (req, res): Promise<void> => {
  const updates = req.body as Record<string, string | null>;
  if (!updates || typeof updates !== "object") {
    res.status(400).json({ error: "Expected an object of key-value pairs" });
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(systemSettings)
      .values({ key, value: value ?? null })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: value ?? null, updatedAt: new Date() } });
  }
  logger.info({ keys: Object.keys(updates) }, "Settings updated");
  res.json({ ok: true });
});

export default router;
