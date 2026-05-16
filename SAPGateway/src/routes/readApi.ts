import { Router, Request, Response } from "express";
import { getDb } from "../db/surreal";
import { ENTITY_CONFIGS } from "../scheduler/syncJob";

const router = Router();

// ── Entities ───────────────────────────────────────────────────────────────────

// GET /api/entities — entity config enriched with latest batch run from SurrealDB
router.get("/entities", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();

    const [configRows, batchRows] = await Promise.all([
      db.query<[Record<string, unknown>[]]>(`SELECT * FROM entity_config ORDER BY name`).catch(() => [[]] as unknown as [Record<string, unknown>[]]),
      db.query<[Record<string, unknown>[]]>(
        `SELECT entity, status, started_at, ended_at, rows_written, watermark, error_message
         FROM batch_run ORDER BY started_at DESC`
      ).catch(() => [[]] as unknown as [Record<string, unknown>[]]),
    ]);

    // Fall back to hardcoded catalogue if entity_config table is empty
    const dbConfigs = configRows[0] ?? [];
    const configs: Record<string, unknown>[] = dbConfigs.length > 0
      ? dbConfigs
      : ENTITY_CONFIGS.map((c) => ({ ...c } as Record<string, unknown>));

    const batchList = batchRows[0] ?? [];

    // Latest batch per entity
    const latestBatch = new Map<string, Record<string, unknown>>();
    for (const b of batchList) {
      const name = b["entity"] as string;
      if (!latestBatch.has(name)) latestBatch.set(name, b);
    }

    const entities = configs.map((cfg) => {
      const latest = latestBatch.get(cfg["name"] as string);
      const cfgStatus = cfg["status"] as string;

      let uiStatus: string;
      if (cfgStatus === "paused") {
        uiStatus = "paused";
      } else if (!latest) {
        uiStatus = "paused";
      } else if (latest["status"] === "error") {
        uiStatus = "error";
      } else {
        uiStatus = "healthy";
      }

      return {
        ...cfg,
        uiStatus,
        watermark: latest?.["watermark"] ?? null,
        lastSync: latest?.["started_at"] ?? null,
        lastBatchStatus: latest?.["status"] ?? null,
        rowsWritten: latest?.["rows_written"] ?? 0,
      };
    });

    res.json({ entities });
  } catch (err) {
    console.error("[ReadAPI] /entities error:", err);
    res.status(500).json({ error: "Failed to load entities" });
  }
});

// PATCH /api/entities/:name/status — pause or resume
router.patch("/entities/:name/status", async (req: Request, res: Response) => {
  const name = String(req.params["name"] ?? "");
  const { status } = req.body as { status: "active" | "paused" };
  if (status !== "active" && status !== "paused") {
    return res.status(400).json({ error: "status must be 'active' or 'paused'" });
  }
  try {
    const db = await getDb();
    await db.query(`UPDATE entity_config SET status = $status WHERE name = $name`, { name, status });
    res.json({ ok: true, name, status });
  } catch (err) {
    console.error("[ReadAPI] PATCH /entities/:name/status error:", err);
    res.status(500).json({ error: "Failed to update entity status" });
  }
});

// POST /api/entities/:name/trigger — run an immediate sync for one entity
router.post("/entities/:name/trigger", async (req: Request, res: Response) => {
  const name = String(req.params["name"] ?? "");
  try {
    // Dynamically import to avoid circular deps
    const { runAllSyncs } = await import("../scheduler/syncJob");
    // Run in background — don't await
    runAllSyncs().catch(console.error);
    res.json({ ok: true, message: `Sync triggered for all active entities` });
  } catch (err) {
    console.error("[ReadAPI] POST /entities/:name/trigger error:", err);
    res.status(500).json({ error: "Failed to trigger sync" });
  }
});

// ── Batch runs ─────────────────────────────────────────────────────────────────

// GET /api/batches?entity=X&limit=100
router.get("/batches", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { entity, limit = "100" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 100, 500);

    const query = entity
      ? `SELECT * FROM batch_run WHERE entity = $entity ORDER BY started_at DESC LIMIT $lim`
      : `SELECT * FROM batch_run ORDER BY started_at DESC LIMIT $lim`;

    const rows = await db.query<[unknown[]]>(query, { entity, lim }).catch(() => [[]] as unknown as [unknown[]]);
    res.json({ batches: rows[0] ?? [], total: (rows[0] ?? []).length });
  } catch (err) {
    console.error("[ReadAPI] /batches error:", err);
    res.status(500).json({ error: "Failed to load batches" });
  }
});

// GET /api/batches/:batchId
router.get("/batches/:batchId", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const batchId = String(req.params["batchId"] ?? "");
    const rows = await db.query<[unknown[]]>(
      `SELECT * FROM batch_run WHERE batch_id = $batchId LIMIT 1`,
      { batchId }
    );
    const batch = (rows[0] ?? [])[0];
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    res.json({ batch });
  } catch (err) {
    console.error("[ReadAPI] /batches/:id error:", err);
    res.status(500).json({ error: "Failed to load batch" });
  }
});

// ── Alerts ─────────────────────────────────────────────────────────────────────

// GET /api/alerts
router.get("/alerts", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.query<[unknown[]]>(
      `SELECT * FROM alert ORDER BY time DESC LIMIT 100`
    ).catch(() => [[]] as unknown as [unknown[]]);
    res.json({ alerts: rows[0] ?? [] });
  } catch (err) {
    console.error("[ReadAPI] /alerts error:", err);
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

// PATCH /api/alerts/:alertId/ack
router.patch("/alerts/:alertId/ack", async (req: Request, res: Response) => {
  const alertId = String(req.params["alertId"] ?? "");
  try {
    const db = await getDb();
    await db.query(
      `UPDATE alert SET acknowledged = true WHERE alert_id = $alertId`,
      { alertId }
    );
    res.json({ ok: true, alertId });
  } catch (err) {
    console.error("[ReadAPI] /alerts/:id/ack error:", err);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────────────

// GET /api/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const db = await getDb();

    const [totalRows, errorRows, recentRows, entityRows] = await Promise.all([
      db.query<[{ count: number }[]]>(`SELECT count() as count FROM batch_run GROUP ALL`),
      db.query<[{ count: number }[]]>(`SELECT count() as count FROM batch_run WHERE status = 'error' GROUP ALL`),
      db.query<[{ count: number }[]]>(`SELECT count() as count FROM batch_run WHERE started_at > time::now() - 1h GROUP ALL`),
      db.query<[{ name: string; status: string }[]]>(`SELECT name, status FROM entity_config`),
    ]);

    const total = totalRows[0]?.[0]?.count ?? 0;
    const errors = errorRows[0]?.[0]?.count ?? 0;
    const recentSyncs = recentRows[0]?.[0]?.count ?? 0;
    const allEntities = entityRows[0] ?? [];
    const activeEntities = allEntities.filter((e) => e.status === "active").length;

    res.json({
      totalBatches: total,
      errorBatches: errors,
      successRate: total > 0 ? Math.round(((total - errors) / total) * 100) : 100,
      recentSyncsLastHour: recentSyncs,
      totalEntities: allEntities.length,
      activeEntities,
    });
  } catch (err) {
    console.error("[ReadAPI] /stats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ── Raw table peek ─────────────────────────────────────────────────────────────

router.get("/records/:table", async (req: Request, res: Response) => {
  const allowed = [
    "hr_employee", "cost_centre", "wbs_element", "vendor",
    "expense_report", "purchase_order", "gl_posting",
    "batch_run", "entity_config", "alert",
  ];
  const table = String(req.params["table"] ?? "");
  if (!allowed.includes(table)) {
    return res.status(400).json({ error: `Table '${table}' not accessible` });
  }
  try {
    const db = await getDb();
    const { limit = "20" } = req.query as Record<string, string>;
    const rows = await db.query<[unknown[]]>(`SELECT * FROM ${table} LIMIT ${Math.min(parseInt(limit, 10) || 20, 200)}`);
    res.json({ table, records: rows[0] ?? [], count: (rows[0] ?? []).length });
  } catch (err) {
    console.error("[ReadAPI] /records error:", err);
    res.status(500).json({ error: "Failed to query table" });
  }
});

export default router;
