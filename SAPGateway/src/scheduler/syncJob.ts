import cron from "node-cron";
import { getDb, upsert } from "../db/surreal";
import { hrEmployees } from "../data/hrMaster";
import { costCentres, wbsElements } from "../data/costCodes";
import { expenseReports, expenseLineItems } from "../data/expenses";
import { vendors } from "../data/vendorMaster";
import { purchaseOrders, poLineItems } from "../data/purchaseOrders";
import { glPostings, glLineItems } from "../data/glPostings";
import { StringRecordId } from "surrealdb";

export interface EntityConfig {
  name: string;
  kind: "master" | "transactional" | "gl";
  service: string;
  entitySet: string;
  schedule: string;
  target: string;
  status: "active" | "paused";
}

export interface BatchRun {
  batch_id: string;
  entity: string;
  service: string;
  entitySet: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  status: "ok" | "error";
  rows_extracted: number;
  rows_written: number;
  rows_rejected: number;
  watermark: string;
  error_message: string | null;
}

export interface BifrostAlert {
  alert_id: string;
  severity: "info" | "warning" | "error" | "critical";
  entity: string;
  message: string;
  time: string;
  acknowledged: boolean;
  batch_id: string | null;
}

export const ENTITY_CONFIGS: EntityConfig[] = [
  { name: "hr_employee",    kind: "master",       service: "HCM_HR_MASTER",   entitySet: "EmployeeSet",       schedule: "*/5 * * * *", target: "bifrost.sap.hr_employee",    status: "active" },
  { name: "cost_centre",    kind: "master",       service: "BIFROST_COST",    entitySet: "CostCentreSet",     schedule: "*/5 * * * *", target: "bifrost.sap.cost_centre",    status: "active" },
  { name: "wbs_element",    kind: "master",       service: "BIFROST_COST",    entitySet: "WBSElementSet",     schedule: "*/5 * * * *", target: "bifrost.sap.wbs_element",    status: "active" },
  { name: "vendor",         kind: "master",       service: "BIFROST_VENDOR",  entitySet: "VendorSet",         schedule: "*/5 * * * *", target: "bifrost.sap.vendor",         status: "active" },
  { name: "expense_report", kind: "transactional",service: "BIFROST_EXPENSES",entitySet: "ExpenseReportSet",  schedule: "*/5 * * * *", target: "bifrost.sap.expense_report", status: "active" },
  { name: "purchase_order", kind: "transactional",service: "BIFROST_MM",      entitySet: "PurchaseOrderSet",  schedule: "*/5 * * * *", target: "bifrost.sap.purchase_order", status: "active" },
  { name: "gl_posting",     kind: "gl",           service: "BIFROST_FI",      entitySet: "GLPostingSet",      schedule: "*/5 * * * *", target: "bifrost.sap.gl_posting",     status: "active" },
];

interface SyncEntity {
  name: string;
  service: string;
  entitySet: string;
  sync: () => Promise<number>;
}

const SYNC_ENTITIES: SyncEntity[] = [
  {
    name: "hr_employee", service: "HCM_HR_MASTER", entitySet: "EmployeeSet",
    sync: async () => {
      for (const r of hrEmployees) await upsert("hr_employee", r.EmployeeID, r as unknown as Record<string, unknown>);
      return hrEmployees.length;
    },
  },
  {
    name: "cost_centre", service: "BIFROST_COST", entitySet: "CostCentreSet",
    sync: async () => {
      for (const r of costCentres) await upsert("cost_centre", r.CostCentreID, r as unknown as Record<string, unknown>);
      return costCentres.length;
    },
  },
  {
    name: "wbs_element", service: "BIFROST_COST", entitySet: "WBSElementSet",
    sync: async () => {
      for (const r of wbsElements) await upsert("wbs_element", r.WBSCode.replace(/-/g, "_"), r as unknown as Record<string, unknown>);
      return wbsElements.length;
    },
  },
  {
    name: "vendor", service: "BIFROST_VENDOR", entitySet: "VendorSet",
    sync: async () => {
      for (const r of vendors) await upsert("vendor", r.VendorID, r as unknown as Record<string, unknown>);
      return vendors.length;
    },
  },
  {
    name: "expense_report", service: "BIFROST_EXPENSES", entitySet: "ExpenseReportSet",
    sync: async () => {
      for (const r of expenseReports) await upsert("expense_report", r.ExpenseReportID.replace(/-/g, "_"), r as unknown as Record<string, unknown>);
      for (const r of expenseLineItems) await upsert("expense_line_item", r.LineItemID.replace(/-/g, "_"), r as unknown as Record<string, unknown>);
      return expenseReports.length + expenseLineItems.length;
    },
  },
  {
    name: "purchase_order", service: "BIFROST_MM", entitySet: "PurchaseOrderSet",
    sync: async () => {
      for (const r of purchaseOrders) await upsert("purchase_order", r.PONumber, r as unknown as Record<string, unknown>);
      for (const r of poLineItems) await upsert("po_line_item", r.LineItemID.replace(/-/g, "_"), r as unknown as Record<string, unknown>);
      return purchaseOrders.length + poLineItems.length;
    },
  },
  {
    name: "gl_posting", service: "BIFROST_FI", entitySet: "GLPostingSet",
    sync: async () => {
      for (const r of glPostings) await upsert("gl_posting", r.DocumentNumber, r as unknown as Record<string, unknown>);
      for (const r of glLineItems) await upsert("gl_line_item", `${r.DocumentNumber}_${r.LineNumber}`, r as unknown as Record<string, unknown>);
      return glPostings.length + glLineItems.length;
    },
  },
];

export async function seedEntityConfigs(): Promise<void> {
  const db = await getDb();
  let seeded = 0;

  for (const cfg of ENTITY_CONFIGS) {
    try {
      // Check for existing status to preserve pause/resume — table may not exist yet, so catch
      let existingStatus: string | undefined;
      try {
        const existing = await db.query<[{ status: string }[]]>(
          `SELECT status FROM entity_config WHERE name = $name LIMIT 1`,
          { name: cfg.name }
        );
        existingStatus = existing[0]?.[0]?.status;
      } catch {
        // Table doesn't exist yet — first run, use default status
      }

      const record = { ...cfg, status: existingStatus ?? cfg.status };
      // Use SDK upsert (auto-creates the table, unlike raw SQL UPSERT in SurrealDB v3)
      await db.upsert(new StringRecordId(`entity_config:${cfg.name}`)).content(record as unknown as Record<string, unknown>);
      seeded++;
    } catch (err) {
      console.error(`[Scheduler] Failed to seed entity_config for "${cfg.name}":`, err);
    }
  }

  console.log(`[Scheduler] Seeded ${seeded}/${ENTITY_CONFIGS.length} entity configs into SurrealDB`);
}

async function writeAlert(alert: BifrostAlert): Promise<void> {
  const db = await getDb();
  await db.upsert(new StringRecordId(`alert:${alert.alert_id}`)).content(alert as unknown as Record<string, unknown>);
}

async function writeBatchRun(batch: BatchRun): Promise<void> {
  const db = await getDb();
  await db.upsert(new StringRecordId(`batch_run:${batch.batch_id}`)).content(batch as unknown as Record<string, unknown>);
}

async function isEntityActive(name: string): Promise<boolean> {
  try {
    const db = await getDb();
    const rows = await db.query<[{ status: string }[]]>(
      `SELECT status FROM entity_config WHERE name = $name LIMIT 1`,
      { name }
    );
    return (rows[0]?.[0]?.status ?? "active") === "active";
  } catch {
    // Table doesn't exist yet — treat all entities as active
    return true;
  }
}

export async function runAllSyncs(): Promise<BatchRun[]> {
  const results: BatchRun[] = [];

  for (const entity of SYNC_ENTITIES) {
    const active = await isEntityActive(entity.name);
    if (!active) {
      console.log(`[Scheduler] Skipping ${entity.name} — paused`);
      continue;
    }

    const started_at = new Date().toISOString();
    const t0 = Date.now();
    let rows_written = 0;
    let status: "ok" | "error" = "ok";
    let error_message: string | null = null;

    try {
      rows_written = await entity.sync();
    } catch (err) {
      status = "error";
      error_message = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Error syncing ${entity.name}:`, err);
    }

    const ended_at = new Date().toISOString();
    const duration_ms = Date.now() - t0;
    const ts = started_at.replace(/[^0-9]/g, "").slice(0, 14);
    const batch_id = `${entity.name}_${ts}`;

    const batch: BatchRun = {
      batch_id,
      entity: entity.name,
      service: entity.service,
      entitySet: entity.entitySet,
      started_at,
      ended_at,
      duration_ms,
      status,
      rows_extracted: rows_written,
      rows_written,
      rows_rejected: 0,
      watermark: ended_at,
      error_message,
    };

    await writeBatchRun(batch);

    if (status === "error") {
      const alert: BifrostAlert = {
        alert_id: `${batch_id}_err`,
        severity: "error",
        entity: entity.name,
        message: error_message ?? "Sync failed",
        time: ended_at,
        acknowledged: false,
        batch_id,
      };
      await writeAlert(alert);
    }

    results.push(batch);
    console.log(`[Scheduler] ${entity.name}: ${status} — ${rows_written} rows in ${duration_ms}ms`);
  }

  return results;
}

export function startScheduler(cronExpression = "*/5 * * * *"): void {
  console.log(`[Scheduler] Starting — cron: "${cronExpression}"`);

  runAllSyncs().catch((err) => console.error("[Scheduler] Initial sync failed:", err));

  cron.schedule(cronExpression, () => {
    console.log(`[Scheduler] Tick — ${new Date().toISOString()}`);
    runAllSyncs().catch((err) => console.error("[Scheduler] Sync failed:", err));
  });
}
