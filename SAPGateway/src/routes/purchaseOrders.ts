import { Router, Request, Response } from "express";
import { purchaseOrders, poLineItems } from "../data/purchaseOrders";
import { upsert } from "../db/surreal";

const router = Router();

router.get("/PurchaseOrderSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...purchaseOrders];
    if ($filter) {
      const statusMatch = $filter.match(/Status\s+eq\s+'([^']+)'/);
      if (statusMatch) results = results.filter((r) => r.Status === statusMatch[1]);
      const vendorMatch = $filter.match(/VendorID\s+eq\s+'([^']+)'/);
      if (vendorMatch) results = results.filter((r) => r.VendorID === vendorMatch[1]);
    }
    for (const po of results) {
      await upsert("purchase_order", po.PONumber, po as unknown as Record<string, unknown>);
    }
    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[PO] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/PurchaseOrderSet/:PONumber", async (req: Request, res: Response) => {
  const num = String(req.params["PONumber"] ?? "").replace(/['"]/g, "");
  const po = purchaseOrders.find((p) => p.PONumber === num);
  if (!po) {
    return res.status(404).json({ error: { code: "404", message: { value: "PO not found" } } });
  }
  await upsert("purchase_order", po.PONumber, po as unknown as Record<string, unknown>);
  res.json({ d: po });
});

router.get("/POLineItemSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...poLineItems];
    if ($filter) {
      const poMatch = $filter.match(/PONumber\s+eq\s+'([^']+)'/);
      if (poMatch) results = results.filter((l) => l.PONumber === poMatch[1]);
    }
    for (const line of results) {
      await upsert("po_line_item", line.LineItemID.replace(/-/g, "_"), line as unknown as Record<string, unknown>);
    }
    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[PO] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

export default router;
