import { Router, type IRouter } from "express";
import {
  db,
  stockItemsTable,
  dispatchesTable,
  inventoryItemsTable,
  warehousesTable,
  voiceCommands,
} from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { eq, ilike, lte, desc, and } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { generateDailyReport } from "../../lib/report-generator";

const router: IRouter = Router();

// ─── Intent Parser Prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the voice operations controller for SIHIYAN, a seeds operations management platform for SIHI Seeds (India).

Parse spoken commands in English, Kannada (kn-IN), or Malayalam (ml-IN) and return structured JSON.

AVAILABLE ACTIONS (execute ALL immediately — only DELETE_STOCK needs confirmation):

ADD_STOCK — Create new stock item
  params: name(str), category(str, one of: Paddy/Oilseed/Cereal/Vegetable/Cash Crop/Pulse/Spice), quantity(num), unit(str default "kg"), unitPrice(num optional), minQuantity(num default 50)
  example: "Add 200 kg cotton seeds" → {name:"Cotton Seeds", category:"Cash Crop", quantity:200, unit:"kg"}

ADJUST_STOCK — Change quantity of existing item (add or reduce)
  params: name(str, partial), delta(num, positive=add, negative=reduce), reason(str optional)
  example: "Add 50 bags of paddy" → {name:"paddy", delta:50, reason:"restock"}
  example: "Reduce cotton by 30 kg" → {name:"cotton", delta:-30, reason:"dispatch"}

DELETE_STOCK — Remove stock item (REQUIRES CONFIRMATION — set requiresConfirmation:true)
  params: name(str)

GET_STOCK — Get stock levels. params: name(str optional), category(str optional)

GET_LOW_STOCK — Show items below minimum threshold. No params.

CREATE_DISPATCH — Create new dispatch order
  params: customerName(str), destination(str), items(str description), quantity(num optional), unit(str optional), driver(str optional), vehicle(str optional)
  example: "Dispatch 50 bags paddy seeds to Ramesh in Telangana"

UPDATE_DISPATCH_STATUS — Change dispatch status
  params: customerName(str) OR trackingNumber(str), status(str: pending/in_transit/delivered/cancelled)
  example: "Mark Ramesh dispatch as delivered"

GET_DISPATCH — Get dispatch info. params: customerName(str optional), status(str optional)

GENERATE_REPORT — Generate AI daily operations report. No params.

GET_SUMMARY — Get current operations summary. No params.

GET_ANALYTICS — Get stock analytics (fast movers, value analysis). No params.

MOVE_INVENTORY — Transfer stock between warehouses
  params: itemName(str), fromWarehouse(str), toWarehouse(str), quantity(num)

UNKNOWN — Command not understood.

RULES:
- "add X bags Y" → ADJUST_STOCK if Y likely exists, ADD_STOCK if creating new item
- "dispatch ... to [place]" → CREATE_DISPATCH
- "mark ... delivered/in transit" → UPDATE_DISPATCH_STATUS
- "report / daily report" → GENERATE_REPORT
- "summary / how many / status" → GET_SUMMARY
- "low stock / running out" → GET_LOW_STOCK
- For Kannada/Malayalam: translate intent, numbers in English digits
- requiresConfirmation: true ONLY for DELETE_STOCK
- confirmationPrompt in same language as user

Respond ONLY with valid JSON:
{
  "action": "ACTION_NAME",
  "confidence": 0.0-1.0,
  "details": { ...params },
  "message": "What you understood (same language as user)",
  "requiresConfirmation": false,
  "confirmationPrompt": null
}`;

type ParsedVoiceCommand = {
  action: string;
  confidence: number;
  details: Record<string, unknown>;
  message: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string | null;
};

const CATEGORY_BY_KEYWORD: Array<[string, string]> = [
  ["paddy", "Paddy"],
  ["rice", "Paddy"],
  ["cotton", "Cash Crop"],
  ["sunflower", "Oilseed"],
  ["oilseed", "Oilseed"],
  ["cereal", "Cereal"],
  ["vegetable", "Vegetable"],
  ["tomato", "Vegetable"],
  ["pulse", "Pulse"],
  ["spice", "Spice"],
];

function categoryForName(name: string): string {
  const lower = name.toLowerCase();
  return CATEGORY_BY_KEYWORD.find(([keyword]) => lower.includes(keyword))?.[1] ?? "Vegetable";
}

function cleanItemName(value: string): string {
  return value
    .replace(/\b(stock|item|seed|seeds|kg|kgs|bags?|units?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseLocalIntent(transcript: string): ParsedVoiceCommand {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const quantityMatch = lower.match(/(\d+(?:\.\d+)?)/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : undefined;
  const unit = lower.match(/\b(bags?|kg|kgs|units?)\b/)?.[1]?.replace(/s$/, "") ?? "kg";

  if (/\b(low stock|running out|below minimum)\b/.test(lower)) {
    return {
      action: "GET_LOW_STOCK",
      confidence: 0.85,
      details: {},
      message: "Checking low stock items.",
      requiresConfirmation: false,
    };
  }

  if (/\b(summary|overview|status|how many)\b/.test(lower)) {
    return {
      action: "GET_SUMMARY",
      confidence: 0.8,
      details: {},
      message: "Getting the current operations summary.",
      requiresConfirmation: false,
    };
  }

  if (/\b(analytics|analysis|value|fast movers?)\b/.test(lower)) {
    return {
      action: "GET_ANALYTICS",
      confidence: 0.8,
      details: {},
      message: "Getting inventory analytics.",
      requiresConfirmation: false,
    };
  }

  if (/\b(report|daily report)\b/.test(lower)) {
    return {
      action: "GENERATE_REPORT",
      confidence: 0.8,
      details: {},
      message: "Generating the daily operations report.",
      requiresConfirmation: false,
    };
  }

  if (/\b(show|get|check|list)\b/.test(lower) && /\b(stock|inventory|seeds?|items?)\b/.test(lower)) {
    const nameMatch = lower.match(/\b(?:stock|inventory)\s+(?:for|of)?\s*(.+)$/) ?? lower.match(/\b(?:show|get|check)\s+(.+?)\s+(?:stock|inventory)\b/);
    const name = nameMatch?.[1] ? cleanItemName(nameMatch[1]) : undefined;
    return {
      action: "GET_STOCK",
      confidence: 0.75,
      details: name ? { name } : {},
      message: name ? `Checking stock for ${name}.` : "Checking stock items.",
      requiresConfirmation: false,
    };
  }

  if (/\b(delete|remove)\b/.test(lower)) {
    const name = cleanItemName(lower.replace(/^.*?\b(delete|remove)\b/, ""));
    return {
      action: "DELETE_STOCK",
      confidence: 0.75,
      details: { name },
      message: `Delete ${name}.`,
      requiresConfirmation: true,
      confirmationPrompt: `Are you sure you want to delete ${name}?`,
    };
  }

  if (/\b(dispatch|send|ship)\b/.test(lower)) {
    const destination = lower.match(/\bin\s+([a-z\s]+)$/)?.[1]?.trim() ?? lower.match(/\bto\s+([a-z\s]+)$/)?.[1]?.trim() ?? "Unknown";
    const customerName = lower.match(/\bto\s+([a-z]+)\b/)?.[1] ?? "Customer";
    const itemMatch = lower.match(/\b(?:dispatch|send|ship)\s+(?:\d+(?:\.\d+)?\s*)?(?:bags?|kg|kgs|units?)?\s*(.+?)\s+to\b/);
    return {
      action: "CREATE_DISPATCH",
      confidence: 0.75,
      details: {
        customerName: customerName.replace(/\b\w/g, (char) => char.toUpperCase()),
        destination: destination.replace(/\b\w/g, (char) => char.toUpperCase()),
        items: itemMatch?.[1] ? cleanItemName(itemMatch[1]) : "Seeds",
        quantity,
        unit,
      },
      message: "Creating a dispatch order.",
      requiresConfirmation: false,
    };
  }

  if (/\b(mark|update)\b/.test(lower) && /\b(delivered|pending|cancelled|canceled|in transit)\b/.test(lower)) {
    const status = lower.includes("delivered")
      ? "delivered"
      : lower.includes("cancel")
      ? "cancelled"
      : lower.includes("pending")
      ? "pending"
      : "in_transit";
    const customerName = lower.match(/\bmark\s+(.+?)\s+(?:dispatch\s+)?(?:as|to)\b/)?.[1] ?? lower.match(/\bupdate\s+(.+?)\s+(?:dispatch\s+)?(?:as|to)\b/)?.[1] ?? "";
    return {
      action: "UPDATE_DISPATCH_STATUS",
      confidence: 0.75,
      details: { customerName: cleanItemName(customerName), status },
      message: "Updating dispatch status.",
      requiresConfirmation: false,
    };
  }

  if (/\b(add|increase|reduce|decrease)\b/.test(lower) && quantity !== undefined) {
    const isReduction = /\b(reduce|decrease)\b/.test(lower);
    const afterQuantity = lower.slice((quantityMatch?.index ?? 0) + quantityMatch![0].length);
    const name = cleanItemName(afterQuantity);
    return {
      action: isReduction ? "ADJUST_STOCK" : "ADD_STOCK",
      confidence: 0.7,
      details: isReduction
        ? { name, delta: -quantity, reason: "voice command" }
        : {
            name,
            category: categoryForName(name),
            quantity,
            unit,
            minQuantity: 50,
          },
      message: `${isReduction ? "Reducing" : "Adding"} stock for ${name}.`,
      requiresConfirmation: false,
    };
  }

  return {
    action: "UNKNOWN",
    confidence: 0,
    details: {},
    message: "I didn't understand that command.",
    requiresConfirmation: false,
  };
}

// ─── Log helper ──────────────────────────────────────────────────────────────

async function logCommand(opts: {
  transcript: string;
  language: string;
  action: string;
  details: Record<string, unknown>;
  success: boolean;
  resultMessage?: string;
  errorMessage?: string;
}) {
  try {
    await db.insert(voiceCommands).values({
      transcript: opts.transcript,
      language: opts.language,
      action: opts.action,
      details: JSON.stringify(opts.details),
      success: opts.success,
      resultMessage: opts.resultMessage ?? null,
      errorMessage: opts.errorMessage ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to log voice command");
  }
}

// ─── Execute action ───────────────────────────────────────────────────────────

async function executeAction(
  action: string,
  details: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: unknown }> {
  // ── ADD_STOCK ─────────────────────────────────────────────────────────────
  if (action === "ADD_STOCK") {
    const name = String(details.name ?? "Unknown Item");
    const category = String(details.category ?? "General");
    const quantity = Math.max(0, Number(details.quantity ?? 0));
    const unit = String(details.unit ?? "kg");
    const minQuantity = Number(details.minQuantity ?? 50);
    const unitPrice = details.unitPrice ? String(details.unitPrice) : null;

    // Check for duplicate
    const [existing] = await db.select().from(stockItemsTable).where(ilike(stockItemsTable.name, `%${name}%`));
    if (existing) {
      // Item exists — adjust instead
      const newQty = parseFloat(String(existing.quantity)) + quantity;
      await db.update(stockItemsTable)
        .set({ quantity: String(newQty), updatedAt: new Date() })
        .where(eq(stockItemsTable.id, existing.id));
      return {
        success: true,
        message: `"${existing.name}" already existed. Added ${quantity} ${unit} → new total: ${newQty} ${unit}.`,
        data: { ...existing, quantity: String(newQty) },
      };
    }

    const sku = `${category.slice(0, 3).toUpperCase()}-${name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const [item] = await db.insert(stockItemsTable).values({
      name, category, sku, quantity: String(quantity), unit,
      minQuantity: String(minQuantity), unitPrice, supplier: null, location: null,
    }).returning();
    return {
      success: true,
      message: `Added "${item.name}" — ${item.quantity} ${item.unit} | SKU: ${item.sku}`,
      data: item,
    };
  }

  // ── ADJUST_STOCK ──────────────────────────────────────────────────────────
  if (action === "ADJUST_STOCK") {
    const name = String(details.name ?? "");
    const delta = Number(details.delta ?? 0);
    const [existing] = await db.select().from(stockItemsTable).where(ilike(stockItemsTable.name, `%${name}%`));
    if (!existing) {
      return { success: false, message: `No stock item found matching "${name}". Try saying the exact product name.` };
    }
    const current = parseFloat(String(existing.quantity));
    const newQty = Math.max(0, current + delta);
    await db.update(stockItemsTable)
      .set({ quantity: String(newQty), updatedAt: new Date() })
      .where(eq(stockItemsTable.id, existing.id));
    const direction = delta > 0 ? `increased by ${delta}` : `reduced by ${Math.abs(delta)}`;
    return {
      success: true,
      message: `${existing.name} ${direction}. Previous: ${current} ${existing.unit} → Now: ${newQty} ${existing.unit}`,
      data: { ...existing, quantity: String(newQty), previousQuantity: current },
    };
  }

  // ── DELETE_STOCK ──────────────────────────────────────────────────────────
  if (action === "DELETE_STOCK") {
    const name = String(details.name ?? "");
    const [existing] = await db.select().from(stockItemsTable).where(ilike(stockItemsTable.name, `%${name}%`));
    if (!existing) {
      return { success: false, message: `No stock item found matching "${name}".` };
    }
    await db.delete(stockItemsTable).where(eq(stockItemsTable.id, existing.id));
    return {
      success: true,
      message: `"${existing.name}" permanently removed from stock.`,
      data: existing,
    };
  }

  // ── GET_STOCK ─────────────────────────────────────────────────────────────
  if (action === "GET_STOCK") {
    const name = details.name as string | undefined;
    const category = details.category as string | undefined;
    let items = await db.select().from(stockItemsTable);
    if (name) items = items.filter(i => i.name.toLowerCase().includes(name.toLowerCase()));
    if (category) items = items.filter(i => i.category.toLowerCase().includes(category.toLowerCase()));

    if (items.length === 0) {
      return { success: true, message: `No stock items found${name ? ` matching "${name}"` : ""}.`, data: [] };
    }
    const summary = items.slice(0, 5).map(i => `${i.name}: ${i.quantity} ${i.unit}`).join(", ");
    const more = items.length > 5 ? ` and ${items.length - 5} more` : "";
    return {
      success: true,
      message: `Found ${items.length} item${items.length > 1 ? "s" : ""}: ${summary}${more}.`,
      data: items,
    };
  }

  // ── GET_LOW_STOCK ─────────────────────────────────────────────────────────
  if (action === "GET_LOW_STOCK") {
    const allItems = await db.select().from(stockItemsTable);
    const lowItems = allItems.filter(i => parseFloat(String(i.quantity)) <= parseFloat(String(i.minQuantity)));
    if (lowItems.length === 0) {
      return { success: true, message: "All stock items are above minimum threshold. No low stock alerts.", data: [] };
    }
    const list = lowItems.map(i => `${i.name} (${i.quantity}/${i.minQuantity} ${i.unit})`).join(", ");
    return {
      success: true,
      message: `${lowItems.length} item${lowItems.length > 1 ? "s are" : " is"} low on stock: ${list}`,
      data: lowItems,
    };
  }

  // ── CREATE_DISPATCH ───────────────────────────────────────────────────────
  if (action === "CREATE_DISPATCH") {
    const trackingNumber = `SHS${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${Math.floor(1000 + Math.random() * 9000)}`;
    const [dispatch] = await db.insert(dispatchesTable).values({
      trackingNumber,
      customerName: String(details.customerName ?? "Customer"),
      destination: String(details.destination ?? "Unknown"),
      items: String(details.items ?? "Seeds"),
      status: "pending",
      driver: details.driver ? String(details.driver) : null,
      vehicle: details.vehicle ? String(details.vehicle) : null,
      totalWeight: details.quantity ? String(details.quantity) : null,
      dispatchDate: new Date(),
    }).returning();
    return {
      success: true,
      message: `Dispatch created — Tracking: ${dispatch.trackingNumber} | To: ${dispatch.customerName}, ${dispatch.destination} | Status: Pending`,
      data: dispatch,
    };
  }

  // ── UPDATE_DISPATCH_STATUS ────────────────────────────────────────────────
  if (action === "UPDATE_DISPATCH_STATUS") {
    const searchTerm = String(details.trackingNumber ?? details.customerName ?? "");
    const newStatus = String(details.status ?? "in_transit");
    // Search by tracking number OR customer name
    const allDispatches = await db.select().from(dispatchesTable);
    const found = allDispatches.find(d =>
      d.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!found) {
      return { success: false, message: `No dispatch found for "${searchTerm}". Check customer name or tracking number.` };
    }
    await db.update(dispatchesTable).set({
      status: newStatus,
      deliveredAt: newStatus === "delivered" ? new Date() : undefined,
      updatedAt: new Date(),
    }).where(eq(dispatchesTable.id, found.id));
    return {
      success: true,
      message: `Dispatch ${found.trackingNumber} (${found.customerName} → ${found.destination}) updated to "${newStatus}".`,
      data: { ...found, status: newStatus },
    };
  }

  // ── GET_DISPATCH ──────────────────────────────────────────────────────────
  if (action === "GET_DISPATCH") {
    let dispatches = await db.select().from(dispatchesTable).orderBy(desc(dispatchesTable.createdAt));
    const customerName = details.customerName as string | undefined;
    const status = details.status as string | undefined;
    if (customerName) dispatches = dispatches.filter(d => d.customerName.toLowerCase().includes(customerName.toLowerCase()));
    if (status) dispatches = dispatches.filter(d => d.status === status);
    if (dispatches.length === 0) {
      return { success: true, message: "No dispatches found matching your query.", data: [] };
    }
    const summary = dispatches.slice(0, 3).map(d => `${d.trackingNumber} → ${d.customerName} (${d.status})`).join(", ");
    return {
      success: true,
      message: `Found ${dispatches.length} dispatch${dispatches.length > 1 ? "es" : ""}: ${summary}${dispatches.length > 3 ? "..." : ""}`,
      data: dispatches,
    };
  }

  // ── GENERATE_REPORT ───────────────────────────────────────────────────────
  if (action === "GENERATE_REPORT") {
    const report = await generateDailyReport({ sendSlack: true });
    return {
      success: true,
      message: `Daily operations report generated for ${new Date(report.reportDate).toLocaleDateString("en-IN")}. ${report.summary}`,
      data: report,
    };
  }

  // ── GET_SUMMARY ───────────────────────────────────────────────────────────
  if (action === "GET_SUMMARY") {
    const [stocks, dispatches] = await Promise.all([
      db.select().from(stockItemsTable),
      db.select().from(dispatchesTable),
    ]);
    const lowStock = stocks.filter(i => parseFloat(String(i.quantity)) <= parseFloat(String(i.minQuantity)));
    const pending = dispatches.filter(d => d.status === "pending").length;
    const inTransit = dispatches.filter(d => d.status === "in_transit").length;
    const delivered = dispatches.filter(d => d.status === "delivered").length;
    const totalValue = stocks.reduce((s, i) => s + (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unitPrice ?? "0")) || 0), 0);
    return {
      success: true,
      message: `SIHI Seeds — ${stocks.length} stock items${lowStock.length > 0 ? ` (⚠ ${lowStock.length} low)` : ", all healthy"}. Dispatches: ${pending} pending, ${inTransit} in transit, ${delivered} delivered. Stock value: ₹${totalValue.toLocaleString("en-IN")}.`,
      data: { stockCount: stocks.length, lowStockCount: lowStock.length, dispatches: { pending, inTransit, delivered }, totalValue },
    };
  }

  // ── GET_ANALYTICS ─────────────────────────────────────────────────────────
  if (action === "GET_ANALYTICS") {
    const stocks = await db.select().from(stockItemsTable);
    const highValue = [...stocks].sort((a, b) => {
      const va = parseFloat(String(a.quantity)) * parseFloat(String(a.unitPrice ?? "0"));
      const vb = parseFloat(String(b.quantity)) * parseFloat(String(b.unitPrice ?? "0"));
      return vb - va;
    }).slice(0, 3);
    const lowStock = stocks.filter(i => parseFloat(String(i.quantity)) <= parseFloat(String(i.minQuantity)));
    const totalValue = stocks.reduce((s, i) => s + (parseFloat(String(i.quantity)) || 0) * (parseFloat(String(i.unitPrice ?? "0")) || 0), 0);
    const highValueList = highValue.map(i => `${i.name} (₹${(parseFloat(String(i.quantity)) * parseFloat(String(i.unitPrice ?? "0"))).toLocaleString("en-IN")})`).join(", ");
    return {
      success: true,
      message: `Analytics: Total inventory value ₹${totalValue.toLocaleString("en-IN")}. Top value items: ${highValueList || "N/A"}. Low stock alerts: ${lowStock.length}.`,
      data: { totalValue, highValue, lowStockCount: lowStock.length, totalItems: stocks.length },
    };
  }

  // ── MOVE_INVENTORY ────────────────────────────────────────────────────────
  if (action === "MOVE_INVENTORY") {
    const itemName = String(details.itemName ?? "");
    const fromName = String(details.fromWarehouse ?? "");
    const toName = String(details.toWarehouse ?? "");
    const qty = Number(details.quantity ?? 0);

    const [stockItem] = await db.select().from(stockItemsTable).where(ilike(stockItemsTable.name, `%${itemName}%`));
    const warehouses = await db.select().from(warehousesTable);
    const fromWh = warehouses.find(w => w.name.toLowerCase().includes(fromName.toLowerCase()));
    const toWh = warehouses.find(w => w.name.toLowerCase().includes(toName.toLowerCase()));

    if (!stockItem) return { success: false, message: `Stock item "${itemName}" not found.` };
    if (!fromWh) return { success: false, message: `Source warehouse "${fromName}" not found.` };
    if (!toWh) return { success: false, message: `Destination warehouse "${toName}" not found.` };

    // Deduct from source inventory record
    const [fromRecord] = await db.select().from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.stockItemId, stockItem.id), eq(inventoryItemsTable.warehouseId, fromWh.id)));
    if (!fromRecord) return { success: false, message: `No inventory record for "${itemName}" at ${fromWh.name}.` };

    const currentQty = parseFloat(String(fromRecord.quantity));
    if (currentQty < qty) return { success: false, message: `Only ${currentQty} ${stockItem.unit} available at ${fromWh.name}. Cannot move ${qty}.` };

    await db.update(inventoryItemsTable)
      .set({ quantity: String(currentQty - qty), updatedAt: new Date() })
      .where(eq(inventoryItemsTable.id, fromRecord.id));

    // Add to destination
    const [toRecord] = await db.select().from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.stockItemId, stockItem.id), eq(inventoryItemsTable.warehouseId, toWh.id)));
    if (toRecord) {
      const toQty = parseFloat(String(toRecord.quantity)) + qty;
      await db.update(inventoryItemsTable)
        .set({ quantity: String(toQty), updatedAt: new Date() })
        .where(eq(inventoryItemsTable.id, toRecord.id));
    } else {
      await db.insert(inventoryItemsTable).values({
        stockItemId: stockItem.id,
        warehouseId: toWh.id,
        quantity: String(qty),
        unit: stockItem.unit,
        batchNumber: null,
        expiryDate: null,
      });
    }

    return {
      success: true,
      message: `Moved ${qty} ${stockItem.unit} of ${stockItem.name} from ${fromWh.name} → ${toWh.name}.`,
      data: { item: stockItem, from: fromWh.name, to: toWh.name, quantity: qty },
    };
  }

  return { success: false, message: "I understood your command but couldn't determine the right action. Please try rephrasing." };
}

// ─── Route: Parse + Execute ───────────────────────────────────────────────────

router.post("/voice/command", async (req, res): Promise<void> => {
  const { transcript, language = "en-US" } = req.body as { transcript: string; language?: string };
  if (!transcript?.trim()) {
    res.status(400).json({ error: "No transcript provided" });
    return;
  }

  // 1. Parse intent with Gemini
  let parsed: {
    action: string;
    confidence: number;
    details: Record<string, unknown>;
    message: string;
    requiresConfirmation?: boolean;
    confirmationPrompt?: string;
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `Language hint: ${language}\nCommand: "${transcript}"` }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    });
    parsed = JSON.parse(response.text ?? "{}");
  } catch (err) {
    logger.warn({ err }, "Gemini intent parse failed; using local voice parser fallback");
    parsed = parseLocalIntent(transcript);
  }

  if (!parsed.action || parsed.action === "UNKNOWN") {
    await logCommand({ transcript, language, action: "UNKNOWN", details: {}, success: false, errorMessage: "Intent not recognized" });
    res.json({
      action: "UNKNOWN",
      confidence: 0,
      details: {},
      message: "I didn't understand that command. Try: 'Add 50 kg cotton seeds', 'Show low stock', 'Generate daily report', or 'Dispatch seeds to Bengaluru'.",
      requiresConfirmation: false,
    });
    return;
  }

  // 2. For DELETE_STOCK — return confirmation request without executing
  if (parsed.requiresConfirmation) {
    // Don't execute yet — send back for confirmation
    await logCommand({ transcript, language, action: parsed.action, details: parsed.details, success: true, resultMessage: "awaiting confirmation" });
    res.json({
      ...parsed,
      executed: false,
    });
    return;
  }

  // 3. Execute immediately for all other actions
  try {
    const result = await executeAction(parsed.action, parsed.details);
    await logCommand({
      transcript, language,
      action: parsed.action,
      details: parsed.details,
      success: result.success,
      resultMessage: result.message,
      errorMessage: result.success ? undefined : result.message,
    });
    res.json({
      action: parsed.action,
      confidence: parsed.confidence ?? 1,
      details: parsed.details,
      message: result.message,
      data: result.data,
      success: result.success,
      executed: true,
      requiresConfirmation: false,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Execution failed";
    logger.error({ err, action: parsed.action }, "Voice action execution failed");
    await logCommand({ transcript, language, action: parsed.action, details: parsed.details, success: false, errorMessage: errMsg });
    res.status(500).json({ error: errMsg, action: parsed.action });
  }
});

// ─── Route: Confirm destructive action ───────────────────────────────────────

router.post("/voice/command/confirm", async (req, res): Promise<void> => {
  const { action, details, transcript = "", language = "en-US" } = req.body as {
    action: string;
    details: Record<string, unknown>;
    transcript?: string;
    language?: string;
  };

  try {
    const result = await executeAction(action, details);
    await logCommand({ transcript, language, action, details, success: result.success, resultMessage: result.message });
    res.json({ ...result, executed: true, requiresConfirmation: false });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Execution failed";
    logger.error({ err, action }, "Voice confirm execution failed");
    await logCommand({ transcript, language, action, details, success: false, errorMessage: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── Route: Command history ───────────────────────────────────────────────────

router.get("/voice/history", async (_req, res): Promise<void> => {
  const history = await db.select().from(voiceCommands).orderBy(desc(voiceCommands.executedAt)).limit(50);
  res.json(history);
});

export default router;
