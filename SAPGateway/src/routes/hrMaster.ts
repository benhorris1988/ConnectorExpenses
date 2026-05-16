import { Router, Request, Response } from "express";
import { hrEmployees } from "../data/hrMaster";
import { upsert } from "../db/surreal";

const router = Router();

// SAP OData style: GET /sap/opu/odata/sap/HCM_HR_MASTER/EmployeeSet
router.get("/EmployeeSet", async (_req: Request, res: Response) => {
  try {
    for (const emp of hrEmployees) {
      await upsert("hr_employee", emp.EmployeeID, emp as unknown as Record<string, unknown>);
    }
    res.json({
      d: {
        results: hrEmployees,
        __count: hrEmployees.length,
      },
    });
  } catch (err) {
    console.error("[HRMaster] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/EmployeeSet/:EmployeeID", async (req: Request, res: Response) => {
  const id = String(req.params["EmployeeID"] ?? "").replace(/['"]/g, "");
  const emp = hrEmployees.find((e) => e.EmployeeID === id);
  if (!emp) {
    return res.status(404).json({ error: { code: "404", message: { value: "Employee not found" } } });
  }
  try {
    await upsert("hr_employee", emp.EmployeeID, emp as unknown as Record<string, unknown>);
    res.json({ d: emp });
  } catch (err) {
    console.error("[HRMaster] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

export default router;
