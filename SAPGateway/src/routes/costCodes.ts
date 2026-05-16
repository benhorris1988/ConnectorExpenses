import { Router, Request, Response } from "express";
import { costCentres, wbsElements } from "../data/costCodes";
import { upsert } from "../db/surreal";

const router = Router();

// GET /sap/opu/odata/sap/BIFROST_COST/CostCentreSet
router.get("/CostCentreSet", async (_req: Request, res: Response) => {
  try {
    for (const cc of costCentres) {
      await upsert("cost_centre", cc.CostCentreID, cc as unknown as Record<string, unknown>);
    }
    res.json({ d: { results: costCentres, __count: costCentres.length } });
  } catch (err) {
    console.error("[CostCodes] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/CostCentreSet/:CostCentreID", async (req: Request, res: Response) => {
  const id = String(req.params["CostCentreID"] ?? "").replace(/['"]/g, "");
  const cc = costCentres.find((c) => c.CostCentreID === id);
  if (!cc) {
    return res.status(404).json({ error: { code: "404", message: { value: "Cost Centre not found" } } });
  }
  await upsert("cost_centre", cc.CostCentreID, cc as unknown as Record<string, unknown>);
  res.json({ d: cc });
});

// GET /sap/opu/odata/sap/BIFROST_COST/WBSElementSet
router.get("/WBSElementSet", async (_req: Request, res: Response) => {
  try {
    for (const wbs of wbsElements) {
      await upsert("wbs_element", wbs.WBSCode.replace(/-/g, "_"), wbs as unknown as Record<string, unknown>);
    }
    res.json({ d: { results: wbsElements, __count: wbsElements.length } });
  } catch (err) {
    console.error("[CostCodes] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/WBSElementSet/:WBSCode", async (req: Request, res: Response) => {
  const code = String(req.params["WBSCode"] ?? "").replace(/['"]/g, "");
  const wbs = wbsElements.find((w) => w.WBSCode === code);
  if (!wbs) {
    return res.status(404).json({ error: { code: "404", message: { value: "WBS Element not found" } } });
  }
  await upsert("wbs_element", wbs.WBSCode.replace(/-/g, "_"), wbs as unknown as Record<string, unknown>);
  res.json({ d: wbs });
});

export default router;
