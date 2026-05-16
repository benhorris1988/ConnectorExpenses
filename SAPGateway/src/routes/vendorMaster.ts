import { Router, Request, Response } from "express";
import { vendors } from "../data/vendorMaster";
import { upsert } from "../db/surreal";

const router = Router();

router.get("/VendorSet", async (_req: Request, res: Response) => {
  try {
    for (const v of vendors) {
      await upsert("vendor", v.VendorID, v as unknown as Record<string, unknown>);
    }
    res.json({ d: { results: vendors, __count: vendors.length } });
  } catch (err) {
    console.error("[Vendor] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/VendorSet/:VendorID", async (req: Request, res: Response) => {
  const id = String(req.params["VendorID"] ?? "").replace(/['"]/g, "");
  const vendor = vendors.find((v) => v.VendorID === id);
  if (!vendor) {
    return res.status(404).json({ error: { code: "404", message: { value: "Vendor not found" } } });
  }
  await upsert("vendor", vendor.VendorID, vendor as unknown as Record<string, unknown>);
  res.json({ d: vendor });
});

export default router;
