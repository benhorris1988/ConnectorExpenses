import { Router, Request, Response } from "express";
import { expenseReports, expenseLineItems } from "../data/expenses";
import { upsert } from "../db/surreal";

const router = Router();

// GET /sap/opu/odata/sap/BIFROST_EXPENSES/ExpenseReportSet
router.get("/ExpenseReportSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...expenseReports];

    if ($filter) {
      // Basic OData $filter: Status eq 'Submitted'
      const statusMatch = $filter.match(/Status\s+eq\s+'([^']+)'/);
      if (statusMatch) {
        results = results.filter((r) => r.Status === statusMatch[1]);
      }
      const empMatch = $filter.match(/EmployeeID\s+eq\s+'([^']+)'/);
      if (empMatch) {
        results = results.filter((r) => r.EmployeeID === empMatch[1]);
      }
    }

    for (const report of results) {
      await upsert("expense_report", report.ExpenseReportID.replace(/-/g, "_"), report as unknown as Record<string, unknown>);
    }

    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[Expenses] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/ExpenseReportSet/:ExpenseReportID", async (req: Request, res: Response) => {
  const id = String(req.params["ExpenseReportID"] ?? "").replace(/['"]/g, "");
  const report = expenseReports.find((r) => r.ExpenseReportID === id);
  if (!report) {
    return res.status(404).json({ error: { code: "404", message: { value: "Expense report not found" } } });
  }
  await upsert("expense_report", report.ExpenseReportID.replace(/-/g, "_"), report as unknown as Record<string, unknown>);
  res.json({ d: report });
});

// GET /sap/opu/odata/sap/BIFROST_EXPENSES/ExpenseLineItemSet
router.get("/ExpenseLineItemSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...expenseLineItems];

    if ($filter) {
      const reportMatch = $filter.match(/ExpenseReportID\s+eq\s+'([^']+)'/);
      if (reportMatch) {
        results = results.filter((l) => l.ExpenseReportID === reportMatch[1]);
      }
    }

    for (const line of results) {
      await upsert("expense_line_item", line.LineItemID.replace(/-/g, "_"), line as unknown as Record<string, unknown>);
    }

    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[Expenses] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

export default router;
