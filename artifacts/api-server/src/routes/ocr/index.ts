import { Router, type IRouter } from "express";
import { db, scannedBillsTable } from "@workspace/db";
import { ScanBillBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.post("/ocr/scan", async (req, res): Promise<void> => {
  const parsed = ScanBillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, billType } = parsed.data;

  let rawText = "";
  let parsedDataObj: Record<string, unknown> = {};
  let confidence = 0.5;

  try {
    const mimeType = imageBase64.startsWith("/9j/") || imageBase64.startsWith("iVBOR") ? "image/png" : "image/jpeg";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `Extract all text and data from this ${billType ?? "document"} image. Return JSON:
{"rawText":"full text","vendorName":"vendor or null","billAmount":number or null,"billDate":"YYYY-MM-DD or null","billType":"invoice/receipt/etc","items":[],"confidence":0.0-1.0}
Respond ONLY with valid JSON.`,
            },
          ],
        },
      ],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    parsedDataObj = JSON.parse(response.text ?? "{}");
    rawText = String(parsedDataObj.rawText ?? "");
    confidence = Number(parsedDataObj.confidence ?? 0.8);
  } catch (err) {
    logger.warn({ err }, "OCR processing failed");
    rawText = "OCR processing failed. Please ensure the image is clear and try again.";
    confidence = 0;
  }

  const vendorName = parsedDataObj.vendorName ? String(parsedDataObj.vendorName) : null;
  const billAmount = parsedDataObj.billAmount != null ? Number(parsedDataObj.billAmount) : null;
  const billDate = parsedDataObj.billDate ? new Date(String(parsedDataObj.billDate)) : null;

  const [bill] = await db
    .insert(scannedBillsTable)
    .values({
      rawText,
      parsedData: JSON.stringify(parsedDataObj),
      billType: billType ?? (parsedDataObj.billType ? String(parsedDataObj.billType) : null),
      vendorName,
      billAmount: billAmount != null ? String(billAmount) : null,
      billDate,
      confidence: String(confidence),
    })
    .returning();

  res.json({ rawText, parsedData: JSON.stringify(parsedDataObj), confidence, billId: bill.id });
});

router.get("/ocr/bills", async (_req, res): Promise<void> => {
  const bills = await db.select().from(scannedBillsTable).orderBy(scannedBillsTable.createdAt);
  res.json(bills);
});

export default router;
