import { Router, Request, Response } from "express";
import { glPostings, glLineItems } from "../data/glPostings";
import { upsert } from "../db/surreal";

const router = Router();

router.get("/GLPostingSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...glPostings];
    if ($filter) {
      const yearMatch = $filter.match(/FiscalYear\s+eq\s+'([^']+)'/);
      if (yearMatch) results = results.filter((g) => g.FiscalYear === yearMatch[1]);
      const typeMatch = $filter.match(/DocumentType\s+eq\s+'([^']+)'/);
      if (typeMatch) results = results.filter((g) => g.DocumentType === typeMatch[1]);
    }
    for (const posting of results) {
      await upsert("gl_posting", posting.DocumentNumber, posting as unknown as Record<string, unknown>);
    }
    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[GL] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

router.get("/GLPostingSet/:DocumentNumber", async (req: Request, res: Response) => {
  const num = String(req.params["DocumentNumber"] ?? "").replace(/['"]/g, "");
  const posting = glPostings.find((g) => g.DocumentNumber === num);
  if (!posting) {
    return res.status(404).json({ error: { code: "404", message: { value: "GL Posting not found" } } });
  }
  await upsert("gl_posting", posting.DocumentNumber, posting as unknown as Record<string, unknown>);
  res.json({ d: posting });
});

router.get("/GLLineItemSet", async (req: Request, res: Response) => {
  try {
    const { $filter } = req.query as Record<string, string>;
    let results = [...glLineItems];
    if ($filter) {
      const docMatch = $filter.match(/DocumentNumber\s+eq\s+'([^']+)'/);
      if (docMatch) results = results.filter((l) => l.DocumentNumber === docMatch[1]);
      const accountMatch = $filter.match(/GLAccount\s+eq\s+'([^']+)'/);
      if (accountMatch) results = results.filter((l) => l.GLAccount === accountMatch[1]);
    }
    for (const line of results) {
      await upsert("gl_line_item", `${line.DocumentNumber}_${line.LineNumber}`, line as unknown as Record<string, unknown>);
    }
    res.json({ d: { results, __count: results.length } });
  } catch (err) {
    console.error("[GL] Error:", err);
    res.status(500).json({ error: { code: "500", message: { value: "Internal Server Error" } } });
  }
});

export default router;
