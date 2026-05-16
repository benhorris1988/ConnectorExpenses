// Bifrost Operator Console — single-file React artifact.
//
// Judgement calls made where the brief was ambiguous:
//  - "Recent alerts" lives in the right rail on the dashboard (not bottom).
//  - Entity-kind icons: master=Boxes, transactional=ShoppingCart,
//    pricing=Tag, inventory=Warehouse.
//  - Watermark history timeline is rendered as a horizontal stepped line
//    (advancement vs. wall-clock) plus an advancement log below.
//  - Rule-file YAML is rendered with a lightweight token highlighter
//    (no external syntax-highlighting dep — keeps the artifact lean).
//  - Theme preference persists to localStorage.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  LayoutDashboard,
  ListFilter,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Rewind,
  Search,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Sun,
  Tag,
  Triangle,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

type EntityStatus = "healthy" | "warning" | "error" | "paused";
type EntityKind = "master" | "transactional" | "pricing" | "inventory";
type BatchStatus = "ok" | "error" | "running";
type Severity = "info" | "warning" | "error" | "critical";

type StepName =
  | "pre_flight"
  | "extract"
  | "stage"
  | "dq_round_1"
  | "transform"
  | "dq_round_2"
  | "write"
  | "dq_round_3"
  | "advance_watermark"
  | "reconcile";

interface Step {
  name: StepName;
  duration_ms: number;
  status: "ok" | "error";
  rows?: number;
  rows_in?: number;
  rows_out?: number;
  rows_rejected?: number;
  violations?: number;
}

interface BatchRun {
  batch_id: string;
  entity: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  status: BatchStatus;
  operator: "scheduled" | string;
  rows_in: number;
  rows_out: number;
  rows_rejected: number;
  watermark_before: string;
  watermark_after: string;
  steps: Step[];
}

interface BatchError {
  id: string;
  batch_id: string;
  entity: string;
  step: StepName;
  severity: Severity;
  rule_id: string;
  src_key: string;
  message: string;
  run_ts: string;
}

interface Entity {
  name: string;
  kind: EntityKind;
  service: string;
  entitySet: string;
  schedule: string;
  status: EntityStatus;
  target: string;
  watermark: string;
  lastSync: string;
  nextSync: string;
}

interface Alert {
  id: string;
  severity: Severity;
  entity: string;
  message: string;
  time: string;
  acknowledged: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mock data                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-05-16T14:23:00Z").getTime();
const minutes = (m: number) => m * 60_000;
const hours = (h: number) => h * 60 * 60_000;
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260516);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) =>
  Math.floor(lo + rand() * (hi - lo + 1));

const ENTITY_SEED: Array<Omit<Entity, "target" | "watermark" | "lastSync" | "nextSync">> = [
  { name: "customer",          kind: "master",        service: "ZSALES_SRV",     entitySet: "CustomerSet",       schedule: "*/30 * * * *", status: "healthy" },
  { name: "material",          kind: "master",        service: "ZMATERIAL_SRV",  entitySet: "MaterialSet",       schedule: "*/30 * * * *", status: "healthy" },
  { name: "vendor",            kind: "master",        service: "ZVENDOR_SRV",    entitySet: "VendorSet",         schedule: "0 * * * *",    status: "healthy" },
  { name: "sales_org",         kind: "master",        service: "ZORG_SRV",       entitySet: "SalesOrgSet",       schedule: "0 0 * * *",    status: "healthy" },
  { name: "sales_order",       kind: "transactional", service: "ZSALES_SRV",     entitySet: "SalesOrderSet",     schedule: "*/5 * * * *",  status: "warning" },
  { name: "sales_order_item",  kind: "transactional", service: "ZSALES_SRV",     entitySet: "SalesOrderItemSet", schedule: "*/5 * * * *",  status: "healthy" },
  { name: "purchase_order",    kind: "transactional", service: "ZPURCH_SRV",     entitySet: "PurchaseOrderSet",  schedule: "*/10 * * * *", status: "healthy" },
  { name: "delivery",          kind: "transactional", service: "ZLOG_SRV",       entitySet: "DeliverySet",       schedule: "*/10 * * * *", status: "healthy" },
  { name: "pricing_condition", kind: "pricing",       service: "ZPRICE_SRV",     entitySet: "ConditionSet",      schedule: "0 */2 * * *",  status: "error"   },
  { name: "inventory_stock",   kind: "inventory",     service: "ZSTOCK_SRV",     entitySet: "StockSet",          schedule: "*/10 * * * *", status: "healthy" },
  { name: "gl_account",        kind: "master",        service: "ZFIN_SRV",       entitySet: "GLAccountSet",      schedule: "0 0 * * *",    status: "healthy" },
  { name: "cost_center",       kind: "master",        service: "ZFIN_SRV",       entitySet: "CostCenterSet",     schedule: "0 0 * * *",    status: "paused"  },
];

function lastSyncForEntity(name: string, status: EntityStatus): number {
  if (status === "paused") return -hours(8);
  if (name === "pricing_condition") return -minutes(between(45, 95));
  if (name === "sales_order") return -minutes(between(5, 9));
  if (name.includes("sales_order")) return -minutes(between(2, 5));
  if (name === "customer" || name === "material") return -minutes(between(7, 22));
  return -minutes(between(3, 30));
}

function scheduleNextMs(cron: string): number {
  if (cron.startsWith("*/5")) return minutes(between(1, 5));
  if (cron.startsWith("*/10")) return minutes(between(2, 10));
  if (cron.startsWith("*/30")) return minutes(between(3, 28));
  if (cron.startsWith("0 *")) return minutes(between(5, 55));
  if (cron.startsWith("0 */2")) return minutes(between(10, 110));
  return hours(between(1, 6));
}

const ENTITIES: Entity[] = ENTITY_SEED.map((e) => {
  const lastSyncOffset = lastSyncForEntity(e.name, e.status);
  return {
    ...e,
    target: `app.${e.name}`,
    watermark: iso(lastSyncOffset - minutes(between(0, 4))),
    lastSync: iso(lastSyncOffset),
    nextSync: e.status === "paused" ? "" : iso(scheduleNextMs(e.schedule)),
  };
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Live API helpers                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const API_BASE = "http://localhost:3001";

function mapGatewayEntity(raw: Record<string, unknown>): Entity {
  const kind = (raw["kind"] as string) === "gl" ? "transactional" : ((raw["kind"] as EntityKind) ?? "master");
  const schedule = (raw["schedule"] as string) ?? "*/5 * * * *";
  // uiStatus comes from the API (derived from latest batch + config status)
  const uiStatus = (raw["uiStatus"] as EntityStatus) ?? (raw["status"] === "paused" ? "paused" : "healthy");
  return {
    name: raw["name"] as string,
    kind,
    service: raw["service"] as string,
    entitySet: raw["entitySet"] as string,
    schedule,
    status: uiStatus,
    target: (raw["target"] as string) ?? `bifrost.sap.${raw["name"] as string}`,
    watermark: (raw["watermark"] as string) ?? "",
    lastSync: (raw["lastSync"] as string) ?? "",
    nextSync: raw["lastSync"] ? new Date(Date.now() + scheduleNextMs(schedule)).toISOString() : "",
  };
}

function mapGatewayAlert(raw: Record<string, unknown>): Alert {
  return {
    id: raw["alert_id"] as string,
    severity: (raw["severity"] as Alert["severity"]) ?? "info",
    entity: raw["entity"] as string,
    message: raw["message"] as string,
    time: raw["time"] as string,
    acknowledged: (raw["acknowledged"] as boolean) ?? false,
  };
}

function mapGatewayBatch(raw: Record<string, unknown>): BatchRun {
  const dur = (raw["duration_ms"] as number) ?? 1000;
  const rowsIn = (raw["rows_extracted"] as number) ?? 0;
  const rowsOut = (raw["rows_written"] as number) ?? 0;
  const rejected = (raw["rows_rejected"] as number) ?? 0;
  const batchStatus = (raw["status"] as string) === "error" ? "error" : "ok";
  const steps: Step[] = [
    { name: "pre_flight",        duration_ms: Math.round(dur * 0.02), status: "ok" },
    { name: "extract",           duration_ms: Math.round(dur * 0.30), status: "ok", rows: rowsIn },
    { name: "stage",             duration_ms: Math.round(dur * 0.10), status: "ok" },
    { name: "dq_round_1",        duration_ms: Math.round(dur * 0.08), status: "ok", violations: 0 },
    { name: "transform",         duration_ms: Math.round(dur * 0.20), status: "ok", rows_in: rowsIn, rows_out: rowsOut },
    { name: "dq_round_2",        duration_ms: Math.round(dur * 0.05), status: "ok", violations: 0 },
    { name: "write",             duration_ms: Math.round(dur * 0.15), status: batchStatus, rows_out: rowsOut },
    { name: "dq_round_3",        duration_ms: Math.round(dur * 0.04), status: "ok", violations: 0 },
    { name: "advance_watermark", duration_ms: Math.round(dur * 0.03), status: "ok" },
    { name: "reconcile",         duration_ms: Math.round(dur * 0.03), status: "ok", rows_in: rowsIn, rows_out: rowsOut, rows_rejected: rejected },
  ];
  return {
    batch_id: raw["batch_id"] as string,
    entity: raw["entity"] as string,
    started_at: raw["started_at"] as string,
    ended_at: raw["ended_at"] as string,
    duration_ms: dur,
    status: batchStatus,
    operator: "scheduled",
    rows_in: rowsIn,
    rows_out: rowsOut,
    rows_rejected: rejected,
    watermark_before: (raw["started_at"] as string) ?? new Date().toISOString(),
    watermark_after: (raw["watermark"] as string) ?? new Date().toISOString(),
    steps,
  };
}

const STEP_ORDER: StepName[] = [
  "pre_flight",
  "extract",
  "stage",
  "dq_round_1",
  "transform",
  "dq_round_2",
  "write",
  "dq_round_3",
  "advance_watermark",
  "reconcile",
];

const RULE_BANK: { id: string; entities: string[]; message: string }[] = [
  { id: "V-CUST-001", entities: ["customer"], message: "Every customer must have a non-empty name (name is NONE)" },
  { id: "V-CUST-002", entities: ["customer"], message: "Primary address country code does not resolve to a known ISO code" },
  { id: "V-MAT-001",  entities: ["material"], message: "Material group is empty for an active material" },
  { id: "V-MAT-002",  entities: ["material"], message: "Base unit of measure does not resolve to a known UoM" },
  { id: "V-SO-001",   entities: ["sales_order", "sales_order_item"], message: "Customer reference does not exist in the customer master" },
  { id: "V-SO-002",   entities: ["sales_order", "sales_order_item"], message: "Line quantity is not strictly positive" },
  { id: "V-SO-003",   entities: ["sales_order"], message: "Sales order has zero line items" },
  { id: "V-PRICE-001",entities: ["pricing_condition"], message: "Pricing condition validity dates are out of order (valid_from > valid_to)" },
  { id: "V-STOCK-001",entities: ["inventory_stock"], message: "Inventory stock quantity is negative" },
  { id: "V-VENDOR-001",entities: ["vendor"], message: "Vendor tax ID does not match expected country format" },
];

function makeBatchId(entity: string, ts: number, idx: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `P-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}-${entity}${idx ? `-${idx}` : ""}`;
}

function buildSteps(opts: {
  rows: number;
  rejected: number;
  totalDuration: number;
  failAt?: StepName;
}): Step[] {
  const weights: Record<StepName, number> = {
    pre_flight: 3,
    extract: 38,
    stage: 7,
    dq_round_1: 3,
    transform: 14,
    dq_round_2: 4,
    write: 22,
    dq_round_3: 4,
    advance_watermark: 1,
    reconcile: 4,
  };
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0);
  const steps: Step[] = STEP_ORDER.map((n) => ({
    name: n,
    duration_ms: Math.max(8, Math.round((weights[n] / wsum) * opts.totalDuration)),
    status: "ok",
  }));
  for (const s of steps) {
    if (s.name === "extract") s.rows = opts.rows;
    if (s.name === "stage") {
      s.rows_in = opts.rows;
      s.rows_out = opts.rows;
    }
    if (s.name === "transform") {
      s.rows_in = opts.rows;
      s.rows_out = opts.rows;
    }
    if (s.name === "write") {
      s.rows_in = opts.rows - opts.rejected;
      s.rows_out = opts.rows - opts.rejected;
    }
    if (s.name === "dq_round_1") s.violations = 0;
    if (s.name === "dq_round_2") s.violations = opts.rejected;
    if (s.name === "dq_round_3") s.violations = 0;
  }
  if (opts.failAt) {
    const i = steps.findIndex((s) => s.name === opts.failAt);
    if (i >= 0) {
      steps[i].status = "error";
      for (let j = i + 1; j < steps.length; j++) steps[j].duration_ms = 0;
    }
  }
  return steps;
}

function generateBatches(): BatchRun[] {
  const out: BatchRun[] = [];
  for (const e of ENTITIES) {
    if (e.status === "paused") {
      for (let i = 0; i < 8; i++) {
        const startedOffset = -hours(10) - hours(i * 8) + minutes(between(-20, 20));
        const rows = between(20, 80);
        const duration = between(900, 2400);
        out.push({
          batch_id: makeBatchId(e.name, NOW + startedOffset, i),
          entity: e.name,
          started_at: iso(startedOffset),
          ended_at: iso(startedOffset + duration),
          duration_ms: duration,
          status: "ok",
          operator: "scheduled",
          rows_in: rows,
          rows_out: rows,
          rows_rejected: 0,
          watermark_before: iso(startedOffset - hours(8)),
          watermark_after: iso(startedOffset - minutes(2)),
          steps: buildSteps({ rows, rejected: 0, totalDuration: duration }),
        });
      }
      continue;
    }

    const cadenceMin =
      e.schedule.startsWith("*/5") ? 5 :
      e.schedule.startsWith("*/10") ? 10 :
      e.schedule.startsWith("*/30") ? 30 :
      e.schedule.startsWith("0 *") ? 60 :
      e.schedule.startsWith("0 */2") ? 120 : 1440;

    const count = Math.min(40, Math.max(8, Math.floor((24 * 60) / cadenceMin)));

    const baseRows =
      e.kind === "transactional" ? between(400, 1200) :
      e.kind === "pricing" ? between(60, 240) :
      e.kind === "inventory" ? between(300, 900) :
      between(120, 380);

    for (let i = 0; i < count; i++) {
      const startedOffset = -minutes(cadenceMin) * (i + 1) + minutes(between(-1, 1));
      const rows = Math.max(
        0,
        baseRows + between(-Math.floor(baseRows * 0.25), Math.floor(baseRows * 0.25))
      );
      const isPriceErr = e.name === "pricing_condition" && i < 3;

      let rejected = 0;
      if (e.name === "pricing_condition") rejected = between(2, 14);
      else if (e.name === "sales_order") rejected = between(1, 7);
      else if (rand() < 0.18) rejected = between(0, 3);

      const failAt: StepName | undefined = isPriceErr && i === 0 ? "dq_round_2" : undefined;
      const duration = Math.round(
        (e.kind === "transactional" ? 5500 : e.kind === "pricing" ? 3800 : 4200) *
          (0.7 + rand() * 0.7)
      );

      const status: BatchStatus = failAt ? "error" : "ok";

      out.push({
        batch_id: makeBatchId(e.name, NOW + startedOffset, i),
        entity: e.name,
        started_at: iso(startedOffset),
        ended_at: iso(startedOffset + duration),
        duration_ms: duration,
        status,
        operator: "scheduled",
        rows_in: rows,
        rows_out: failAt ? 0 : Math.max(0, rows - rejected),
        rows_rejected: rejected,
        watermark_before: iso(startedOffset - minutes(cadenceMin)),
        watermark_after: failAt
          ? iso(startedOffset - minutes(cadenceMin))
          : iso(startedOffset - minutes(between(1, 3))),
        steps: buildSteps({ rows, rejected, totalDuration: duration, failAt }),
      });
    }
  }
  out.sort((a, b) => +new Date(b.started_at) - +new Date(a.started_at));
  return out;
}

const BATCHES: BatchRun[] = generateBatches();

function generateErrors(): BatchError[] {
  const out: BatchError[] = [];
  let counter = 0;
  for (const b of BATCHES) {
    if (b.rows_rejected === 0 && b.status !== "error") continue;
    const eligibleRules = RULE_BANK.filter((r) => r.entities.includes(b.entity));
    if (eligibleRules.length === 0) continue;

    const weighted: typeof eligibleRules = [];
    for (const r of eligibleRules) {
      const w =
        (b.entity === "pricing_condition" && r.id === "V-PRICE-001") ? 6 :
        (b.entity === "sales_order" && r.id === "V-SO-002") ? 6 :
        2;
      for (let k = 0; k < w; k++) weighted.push(r);
    }

    const errCount = Math.max(b.rows_rejected, b.status === "error" ? 3 : 0);
    for (let i = 0; i < errCount; i++) {
      const r = pick(weighted);
      const severity: Severity =
        b.status === "error" ? "critical" :
        rand() < 0.18 ? "warning" :
        rand() < 0.06 ? "info" :
        "error";
      const tsOffset =
        (+new Date(b.started_at) - NOW) + Math.round(b.duration_ms * (0.2 + rand() * 0.7));
      const srcKey =
        b.entity === "customer" ? `KUNNR=${String(between(10000, 99999)).padStart(10, "0")},VKORG=${pick(["1000","2000","3000"])}` :
        b.entity === "material" ? `MATNR=${String(between(100000, 999999)).padStart(18, "0")}` :
        b.entity === "vendor" ? `LIFNR=${String(between(10000, 99999)).padStart(10, "0")}` :
        b.entity === "sales_order" ? `VBELN=${String(between(2000000, 9999999)).padStart(10, "0")}` :
        b.entity === "sales_order_item" ? `VBELN=${String(between(2000000, 9999999)).padStart(10, "0")},POSNR=${String(between(10, 90)).padStart(6, "0")}` :
        b.entity === "purchase_order" ? `EBELN=${String(between(4500000, 4699999)).padStart(10, "0")}` :
        b.entity === "delivery" ? `VBELN=${String(between(80000000, 89999999)).padStart(10, "0")}` :
        b.entity === "pricing_condition" ? `KNUMH=${String(between(1000000, 9999999)).padStart(10, "0")},KSCHL=${pick(["PR00","ZD01","K007"])}` :
        b.entity === "inventory_stock" ? `MATNR=${String(between(100000, 999999)).padStart(18, "0")},WERKS=${pick(["1000","2000","3000"])}` :
        b.entity === "gl_account" ? `SAKNR=${String(between(100000, 899999)).padStart(10, "0")}` :
        `KOSTL=${String(between(1000, 9999)).padStart(10, "0")}`;
      out.push({
        id: `err-${counter++}`,
        batch_id: b.batch_id,
        entity: b.entity,
        step: "dq_round_2",
        severity,
        rule_id: r.id,
        src_key: srcKey,
        message: r.message,
        run_ts: iso(tsOffset),
      });
    }
  }
  return out;
}

const ERRORS: BatchError[] = generateErrors();

const INITIAL_ALERTS: Alert[] = [
  { id: "a1", severity: "critical", entity: "pricing_condition", message: "Batch failed at dq_round_2: 14 critical violations of V-PRICE-001", time: iso(-minutes(48)),  acknowledged: false },
  { id: "a2", severity: "error",    entity: "pricing_condition", message: "Error rate above 5% threshold over last 1h window",                   time: iso(-minutes(53)),  acknowledged: false },
  { id: "a3", severity: "warning",  entity: "sales_order",       message: "p95 batch duration regression: 8.4s (budget 6.0s)",                   time: iso(-minutes(72)),  acknowledged: false },
  { id: "a4", severity: "warning",  entity: "sales_order",       message: "Watermark advanced by 0s on last batch (no new rows)",                time: iso(-minutes(140)), acknowledged: false },
  { id: "a5", severity: "info",     entity: "cost_center",       message: "Entity paused by operator olivia.chen",                              time: iso(-hours(8)),     acknowledged: true  },
  { id: "a6", severity: "info",     entity: "material",          message: "Schedule changed from */60 to */30",                                  time: iso(-hours(11)),    acknowledged: true  },
  { id: "a7", severity: "warning",  entity: "delivery",          message: "Single-batch reconcile mismatch: stg=412 xfm=411",                    time: iso(-hours(14)),    acknowledged: true  },
  { id: "a8", severity: "info",     entity: "vendor",            message: "Watermark reset by operator marcus.lee (recovery)",                  time: iso(-hours(19)),    acknowledged: true  },
  { id: "a9", severity: "error",    entity: "pricing_condition", message: "OData call returned 503 from ZPRICE_SRV — retried 3×",               time: iso(-hours(22)),    acknowledged: true  },
  { id: "a10",severity: "info",     entity: "customer",          message: "Daily summary: 48 batches, 99.6% success, p95 4.7s",                  time: iso(-hours(23)),    acknowledged: true  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function relTime(isoStr: string | undefined | null): string {
  if (!isoStr) return "—";
  const diff = +new Date(isoStr) - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45_000) return diff < 0 ? "just now" : "imminent";
  const m = Math.round(abs / 60_000);
  if (m < 60) return diff < 0 ? `${m} min ago` : `in ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return diff < 0 ? `${h}h ago` : `in ${h}h`;
  const d = Math.round(h / 24);
  return diff < 0 ? `${d}d ago` : `in ${d}d`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtTs(isoStr: string): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function entityIcon(kind: EntityKind) {
  switch (kind) {
    case "master": return Boxes;
    case "transactional": return ShoppingCart;
    case "pricing": return Tag;
    case "inventory": return Warehouse;
  }
}

function errorRateForEntity(entity: string, batches: BatchRun[]): number {
  const recent = batches.filter((b) => b.entity === entity).slice(0, 24);
  const rowsIn = recent.reduce((a, b) => a + b.rows_in, 0);
  const rej = recent.reduce((a, b) => a + b.rows_rejected, 0);
  if (rowsIn === 0) return 0;
  return (rej / rowsIn) * 100;
}

function rowsLast24(entity: string, batches: BatchRun[]): number[] {
  return batches.filter((b) => b.entity === entity).slice(0, 24).map((b) => b.rows_in).reverse();
}
function errPctLast24(entity: string, batches: BatchRun[]): number[] {
  return batches.filter((b) => b.entity === entity).slice(0, 24).map((b) =>
    b.rows_in === 0 ? 0 : (b.rows_rejected / b.rows_in) * 100
  ).reverse();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Atoms                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function cx(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(" ");
}

function StatusDot({ status, className }: { status: EntityStatus | BatchStatus; className?: string }) {
  const color =
    status === "healthy" || status === "ok" ? "bg-emerald-500" :
    status === "warning" ? "bg-amber-500" :
    status === "error" ? "bg-rose-500" :
    status === "running" ? "bg-blue-500" :
    "bg-zinc-400";
  return <span className={cx("inline-block size-2 rounded-full", color, className)} />;
}

function StatusPill({ status, size = "md" }: { status: EntityStatus | BatchStatus; size?: "sm" | "md" }) {
  const map: Record<string, { label: string; cls: string }> = {
    healthy:  { label: "Healthy",  cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20" },
    ok:       { label: "Ok",       cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20" },
    warning:  { label: "Warning",  cls: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20" },
    error:    { label: "Error",    cls: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20" },
    paused:   { label: "Paused",   cls: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-400/20" },
    running:  { label: "Running",  cls: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20" },
  };
  const m = map[status] ?? map.healthy;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md font-medium ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
        m.cls
      )}
    >
      <StatusDot status={status} />
      {m.label}
    </span>
  );
}

function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const cls = cx("size-3.5", className);
  switch (severity) {
    case "critical": return <ShieldAlert className={cx(cls, "text-rose-600 dark:text-rose-400")} />;
    case "error":    return <AlertTriangle className={cx(cls, "text-rose-600 dark:text-rose-400")} />;
    case "warning":  return <Triangle className={cx(cls, "text-amber-600 dark:text-amber-400")} />;
    case "info":     return <Circle className={cx(cls, "text-zinc-400 dark:text-zinc-500")} />;
  }
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-zinc-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.02)]",
        "dark:border-zinc-800 dark:bg-zinc-900/60",
        className
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  variant = "default",
  size = "md",
  onClick,
  className,
  title,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "default" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    default: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
    ghost:   "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
    outline: "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
    danger:  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-950/40",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
        size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm",
        variants[variant],
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function Sparkline({
  data, height = 24, width = 80, stroke = "currentColor", fill,
}: {
  data: number[]; height?: number; width?: number; stroke?: string; fill?: string;
}) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / span) * (height - 2) - 1] as const);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = fill ? `${path} L ${pts[pts.length - 1][0]} ${height} L 0 ${height} Z` : "";
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <path d={area} fill={fill} opacity={0.25} />}
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BifrostMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="bf-arc" x1="0" x2="24" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="0.45" stopColor="#7c3aed" />
          <stop offset="0.8" stopColor="#db2777" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M3 19 C 6 7, 18 7, 21 19" fill="none" stroke="url(#bf-arc)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M5.5 19 C 8 11, 16 11, 18.5 19" fill="none" stroke="url(#bf-arc)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Routing types                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

type Route =
  | { name: "dashboard" }
  | { name: "entity"; entity: string }
  | { name: "run"; batchId: string; from?: Route }
  | { name: "errors" };

/* ────────────────────────────────────────────────────────────────────────── */
/* Nav rail                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function NavRail({
  route, go, entities, alertCount,
}: {
  route: Route; go: (r: Route) => void; entities: Entity[]; alertCount: number;
}) {
  const items: { id: Route["name"]; label: string; Icon: typeof LayoutDashboard; route: Route; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, route: { name: "dashboard" } },
    { id: "errors", label: "Error Explorer", Icon: ShieldAlert, route: { name: "errors" }, badge: alertCount },
  ];
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-14 items-center gap-2 px-4">
        <BifrostMark />
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Bifrost</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Operator Console</span>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {items.map(({ id, label, Icon, route: r, badge }) => {
          const active = route.name === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(r)}
              className={cx(
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              {active && <span className="bifrost-gradient absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full" />}
              <Icon className="size-4" strokeWidth={1.75} />
              <span className="flex-1 text-left">{label}</span>
              {badge ? (
                <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-300">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 px-4 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Pipelines
      </div>
      <div className="mt-1 flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto px-2">
        {entities.map((e) => {
          const Icon = entityIcon(e.kind);
          const active = route.name === "entity" && route.entity === e.name;
          return (
            <button
              key={e.name}
              type="button"
              onClick={() => go({ name: "entity", entity: e.name })}
              className={cx(
                "group flex items-center gap-2 rounded-md px-2.5 py-1 text-[13px] transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} />
              <span className="flex-1 truncate text-left font-mono text-[12px]">{e.name}</span>
              <StatusDot status={e.status} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Database className="size-3.5" />
          SurrealDB · L4
          <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            online
          </span>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  theme, setTheme, breadcrumbs, go,
}: {
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  breadcrumbs: { label: string; route?: Route }[];
  go: (r: Route) => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/80 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {breadcrumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 truncate">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" />}
            {c.route ? (
              <button
                type="button"
                onClick={() => c.route && go(c.route)}
                className="truncate rounded px-1 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {c.label}
              </button>
            ) : (
              <span className="truncate rounded px-1 text-zinc-900 dark:text-zinc-100">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="relative hidden md:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          placeholder="Search batch_id, src_key, rule…"
          className="w-72 rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-9 text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-700"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-1 py-px text-[10px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
          ⌘K
        </kbd>
      </div>

      <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Toggle theme" className="!px-1.5">
        {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </Button>
      <Button variant="ghost" size="sm" className="!px-1.5" title="Settings">
        <Settings className="size-4" />
      </Button>

      <div className="ml-1 flex items-center gap-2 border-l border-zinc-200 pl-3 dark:border-zinc-800">
        <div className="bifrost-gradient flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white">OC</div>
        <div className="hidden text-right text-[11px] leading-tight md:block">
          <div className="font-medium text-zinc-900 dark:text-zinc-50">olivia.chen</div>
          <div className="text-zinc-400 dark:text-zinc-500">on-call</div>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Dashboard                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function StatCard({
  title, value, hint, accent, spark,
}: {
  title: string; value: React.ReactNode; hint: React.ReactNode;
  accent?: boolean; spark?: number[];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      {accent && <span className="bifrost-gradient absolute inset-x-0 top-0 h-[2px]" />}
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</div>
        {spark && (
          <span className="text-zinc-400 dark:text-zinc-500">
            <Sparkline data={spark} width={70} height={18} />
          </span>
        )}
      </div>
      <div className="mt-2 font-mono text-[28px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</div>
    </div>
  );
}

function DashboardStats({ entities }: { entities: Entity[] }) {
  const healthy = entities.filter((e) => e.status === "healthy").length;
  const paused = entities.filter((e) => e.status === "paused").length;
  const last24 = BATCHES.length;
  const success = BATCHES.filter((b) => b.status === "ok").length;
  const successRate = ((success / last24) * 100).toFixed(1);
  const todayErrors = ERRORS.filter((e) => e.severity === "error" || e.severity === "critical").length;
  const todayWarnings = ERRORS.filter((e) => e.severity === "warning").length;

  const wmAges = entities
    .filter((e) => e.status !== "paused")
    .map((e) => ({ name: e.name, age: NOW - +new Date(e.watermark) }))
    .sort((a, b) => b.age - a.age);
  const oldest = wmAges[0];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        accent
        title="Active entities"
        value={entities.length}
        hint={
          <span>
            <span className="text-emerald-600 dark:text-emerald-400">{healthy} healthy</span>
            {" · "}
            <span className="text-zinc-500">{paused} paused</span>
          </span>
        }
      />
      <StatCard
        accent
        title="Batches · last 24h"
        value={fmtNumber(last24)}
        hint={<span><span className="font-mono">{successRate}%</span> success</span>}
        spark={[88, 92, 90, 94, 89, 96, 91, 93, 95, 90, 92, 94, 97, 91, 93, 95]}
      />
      <StatCard
        accent
        title="DQ violations · today"
        value={fmtNumber(todayErrors + todayWarnings)}
        hint={
          <span>
            <span className="text-rose-600 dark:text-rose-400">{todayErrors} errors</span>
            {" · "}
            <span className="text-amber-600 dark:text-amber-400">{todayWarnings} warnings</span>
          </span>
        }
      />
      <StatCard
        accent
        title="Watermark freshness"
        value={oldest ? `${Math.round(oldest.age / 60_000)} min` : "—"}
        hint={
          <span>
            oldest <span className="font-mono text-zinc-700 dark:text-zinc-300">{oldest?.name ?? "—"}</span>
          </span>
        }
      />
    </div>
  );
}

function Th({
  children, onClick, active, align,
}: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; align?: "right";
}) {
  return (
    <th
      className={cx(
        "px-3 py-2 font-medium",
        align === "right" && "text-right",
        onClick && "cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
      )}
      onClick={onClick}
    >
      <span className={cx("inline-flex items-center gap-1", align === "right" && "justify-end")}>
        {children}
        {active && <ChevronDown className="size-3" />}
      </span>
    </th>
  );
}

function MenuItem({
  icon: Icon, children, onClick, danger,
}: {
  icon: typeof Pause; children: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left",
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function EntitiesTable({
  entities, go, toggleEntity, triggerEntity, resetEntity, batches,
}: {
  entities: Entity[];
  go: (r: Route) => void;
  toggleEntity: (name: string) => void;
  triggerEntity: (name: string) => void;
  resetEntity: (name: string) => void;
  batches: BatchRun[];
}) {
  type SortKey = "status" | "lastSync" | "errPct" | "watermark";
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [filter, setFilter] = useState<"all" | EntityStatus>("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ entity: string; msg: string } | null>(null);

  const statusOrder: Record<EntityStatus, number> = { error: 0, warning: 1, paused: 2, healthy: 3 };

  const view = useMemo(() => {
    let rows = [...entities];
    if (filter !== "all") rows = rows.filter((r) => r.status === filter);
    rows.sort((a, b) => {
      if (sortKey === "status") {
        const s = statusOrder[a.status] - statusOrder[b.status];
        return s !== 0 ? s : +new Date(a.watermark) - +new Date(b.watermark);
      }
      if (sortKey === "lastSync") return +new Date(a.lastSync) - +new Date(b.lastSync);
      if (sortKey === "errPct") return errorRateForEntity(b.name) - errorRateForEntity(a.name);
      return +new Date(a.watermark) - +new Date(b.watermark);
    });
    return rows;
  }, [entities, sortKey, filter]);

  function actAndFlash(name: string, msg: string, fn: () => void) {
    fn();
    setOpenMenu(null);
    setFlash({ entity: name, msg });
    window.setTimeout(() => setFlash((cur) => (cur?.entity === name ? null : cur)), 1800);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Entities</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">One row per entity. Click any row to drill in.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 text-[11px] dark:border-zinc-800">
            {(["all", "error", "warning", "healthy", "paused"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cx(
                  "rounded px-2 py-0.5 capitalize transition-colors",
                  filter === s
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Filter className="size-3.5" />
            Columns
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <Th onClick={() => setSortKey("status")} active={sortKey === "status"}>Entity</Th>
              <Th onClick={() => setSortKey("status")} active={sortKey === "status"}>Status</Th>
              <Th onClick={() => setSortKey("lastSync")} active={sortKey === "lastSync"}>Last sync</Th>
              <Th>Next sync</Th>
              <Th>Last rows</Th>
              <Th onClick={() => setSortKey("errPct")} active={sortKey === "errPct"}>Error rate</Th>
              <Th onClick={() => setSortKey("watermark")} active={sortKey === "watermark"}>Watermark</Th>
              <th className="w-[40px] px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {view.map((e) => {
              const Icon = entityIcon(e.kind);
              const errPct = errorRateForEntity(e.name, batches);
              const rowsSpark = rowsLast24(e.name, batches);
              const errSpark = errPctLast24(e.name, batches);
              const lastBatch = batches.find((b) => b.entity === e.name);

              return (
                <tr
                  key={e.name}
                  className="group cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50/70 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                  onClick={() => go({ name: "entity", entity: e.name })}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <Icon className="size-3.5" strokeWidth={1.75} />
                      </span>
                      <div className="leading-tight">
                        <div className="font-mono text-[13px] text-zinc-900 dark:text-zinc-50">{e.name}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {e.service} · {e.entitySet}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={e.status} />
                    {flash?.entity === e.name && (
                      <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-400">{flash.msg}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300" title={fmtTs(e.lastSync)}>
                    {relTime(e.lastSync)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400" title={e.nextSync && fmtTs(e.nextSync)}>
                    {e.status === "paused" ? <span className="text-zinc-400">—</span> : relTime(e.nextSync)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-zinc-800 dark:text-zinc-200">
                        {fmtNumber(lastBatch?.rows_out ?? 0)}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500">
                        <Sparkline data={rowsSpark.length ? rowsSpark : [0, 0]} stroke="currentColor" fill="currentColor" />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          "font-mono",
                          errPct > 2 ? "text-rose-600 dark:text-rose-400" :
                          errPct > 0.5 ? "text-amber-600 dark:text-amber-400" :
                          "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        {errPct.toFixed(2)}%
                      </span>
                      <span
                        className={cx(
                          errPct > 2 ? "text-rose-500 dark:text-rose-400" :
                          errPct > 0.5 ? "text-amber-500 dark:text-amber-400" :
                          "text-zinc-400 dark:text-zinc-500"
                        )}
                      >
                        <Sparkline data={errSpark.length ? errSpark : [0, 0]} stroke="currentColor" />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300" title={fmtTs(e.watermark)}>
                    {relTime(e.watermark)}
                  </td>
                  <td className="relative px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setOpenMenu(openMenu === e.name ? null : e.name);
                      }}
                      className="inline-flex size-6 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {openMenu === e.name && (
                      <div
                        onClick={(ev) => ev.stopPropagation()}
                        className="absolute right-2 top-9 z-20 w-44 rounded-md border border-zinc-200 bg-white p-1 text-left text-[12px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {e.status === "paused" ? (
                          <MenuItem icon={Play} onClick={() => actAndFlash(e.name, "Resumed", () => toggleEntity(e.name))}>
                            Resume
                          </MenuItem>
                        ) : (
                          <MenuItem icon={Pause} onClick={() => actAndFlash(e.name, "Paused", () => toggleEntity(e.name))}>
                            Pause
                          </MenuItem>
                        )}
                        <MenuItem icon={Zap} onClick={() => actAndFlash(e.name, "Sync triggered", () => triggerEntity(e.name))}>
                          Trigger Now
                        </MenuItem>
                        <MenuItem
                          icon={Rewind}
                          onClick={() => {
                            const ok = window.confirm(
                              `Reset watermark for "${e.name}"?\n\nThis will cause the next batch to re-read history.`
                            );
                            if (ok) actAndFlash(e.name, "Watermark reset", () => resetEntity(e.name));
                            else setOpenMenu(null);
                          }}
                          danger
                        >
                          Reset Watermark…
                        </MenuItem>
                        <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                        <MenuItem
                          icon={ArrowUpRight}
                          onClick={() => {
                            setOpenMenu(null);
                            go({ name: "entity", entity: e.name });
                          }}
                        >
                          View Detail
                        </MenuItem>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AlertsRail({
  alerts, ack, go,
}: {
  alerts: Alert[]; ack: (id: string) => void; go: (r: Route) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Bell className="size-3.5 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent alerts</h2>
        </div>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {alerts.filter((a) => !a.acknowledged).length} new
        </span>
      </div>
      <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800/60">
        {alerts.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-400">No alerts in the last 24h. Nice.</div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={cx(
              "flex flex-col gap-1 px-4 py-3 transition-opacity",
              a.acknowledged && "opacity-40"
            )}
          >
            <div className="flex items-start gap-2">
              <SeverityIcon severity={a.severity} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={() => go({ name: "entity", entity: a.entity })}
                    className="font-mono text-[11px] text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {a.entity}
                  </button>
                  <span>·</span>
                  <span title={fmtTs(a.time)}>{relTime(a.time)}</span>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-zinc-700 dark:text-zinc-200">{a.message}</div>
              </div>
              {!a.acknowledged && (
                <button
                  type="button"
                  onClick={() => ack(a.id)}
                  title="Acknowledge"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Check className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Dashboard({
  entities, alerts, ack, toggleEntity, triggerEntity, resetEntity, go, batches,
}: {
  entities: Entity[];
  alerts: Alert[];
  ack: (id: string) => void;
  toggleEntity: (name: string) => void;
  triggerEntity: (name: string) => void;
  resetEntity: (name: string) => void;
  go: (r: Route) => void;
  batches: BatchRun[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pipeline overview
          </h1>
          <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            SAP ECC 6.0 → SurrealDB · {entities.length} entities · continuous batches
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Clock className="size-3.5" />
          Refreshed just now · auto every 10s
        </div>
      </div>

      <DashboardStats entities={entities} />

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <EntitiesTable
          entities={entities}
          batches={batches}
          go={go}
          toggleEntity={toggleEntity}
          triggerEntity={triggerEntity}
          resetEntity={resetEntity}
        />
        <AlertsRail alerts={alerts} ack={ack} go={go} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Entity Detail                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function chartTheme(theme: "light" | "dark") {
  return {
    axis: theme === "dark" ? "#52525b" : "#a1a1aa",
    grid: theme === "dark" ? "#27272a" : "#f4f4f5",
    tooltipBg: theme === "dark" ? "#18181b" : "#ffffff",
    tooltipBorder: theme === "dark" ? "#27272a" : "#e4e4e7",
    text: theme === "dark" ? "#e4e4e7" : "#3f3f46",
  };
}

function ChartCard({
  title, subtitle, children,
}: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-end justify-between">
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {subtitle && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
      </div>
      {children}
    </Card>
  );
}

function SummaryItem({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={cx("mt-1 size-1.5 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
      <span>{children}</span>
    </li>
  );
}

function EntityOverview({ entity, theme }: { entity: Entity; theme: "light" | "dark" }) {
  const t = chartTheme(theme);
  const last7 = BATCHES.filter((b) => b.entity === entity.name).slice(0, 7 * 24).reverse();
  const last100 = BATCHES.filter((b) => b.entity === entity.name).slice(0, 100);
  const errRate100 = last100.length
    ? (last100.reduce((a, b) => a + b.rows_rejected, 0) /
        Math.max(1, last100.reduce((a, b) => a + b.rows_in, 0))) * 100
    : 0;

  const rowsData = last7.map((b, i) => ({ i, rows: b.rows_in, label: relTime(b.started_at) }));

  const bucketSize = Math.max(1, Math.floor(last7.length / 24));
  const errBuckets: { i: number; pct: number }[] = [];
  const p95Buckets: { i: number; p95: number }[] = [];
  for (let i = 0; i < last7.length; i += bucketSize) {
    const slice = last7.slice(i, i + bucketSize);
    const rin = slice.reduce((a, b) => a + b.rows_in, 0);
    const rej = slice.reduce((a, b) => a + b.rows_rejected, 0);
    errBuckets.push({ i: errBuckets.length, pct: rin ? (rej / rin) * 100 : 0 });
    const ds = slice.map((b) => b.duration_ms).sort((a, b) => a - b);
    const p = ds.length ? ds[Math.floor(ds.length * 0.95)] || ds[ds.length - 1] : 0;
    p95Buckets.push({ i: p95Buckets.length, p95: Math.round(p) });
  }

  const lastBatch = BATCHES.find((b) => b.entity === entity.name);
  const dqEsc24h = ERRORS.filter(
    (e) => e.entity === entity.name && e.severity === "error" && +new Date(e.run_ts) > NOW - hours(24)
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title="Rows synced · last 7 days" subtitle="one bar per batch">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={rowsData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="i" tick={false} stroke={t.axis} />
              <YAxis tick={{ fill: t.axis, fontSize: 10 }} stroke={t.axis} width={36} />
              <Tooltip
                cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  background: t.tooltipBg,
                  border: `1px solid ${t.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.text,
                }}
                labelFormatter={(_v, payload) => payload?.[0]?.payload?.label ?? ""}
                formatter={(v) => [fmtNumber(Number(v)), "rows"]}
              />
              <defs>
                <linearGradient id="bf-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#7c3aed" stopOpacity={0.95} />
                  <stop offset="1" stopColor="#2563eb" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <Bar dataKey="rows" radius={[2, 2, 0, 0]} fill="url(#bf-bar)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Error rate · last 7 days" subtitle="%">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={errBuckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="i" tick={false} stroke={t.axis} />
              <YAxis tick={{ fill: t.axis, fontSize: 10 }} stroke={t.axis} width={36} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  background: t.tooltipBg,
                  border: `1px solid ${t.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.text,
                }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`, "error rate"]}
              />
              <Line type="monotone" dataKey="pct" dot={false} strokeWidth={1.5} stroke="#f43f5e" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="p95 duration · last 7 days" subtitle="seconds">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={p95Buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="i" tick={false} stroke={t.axis} />
              <YAxis
                tick={{ fill: t.axis, fontSize: 10 }}
                stroke={t.axis}
                width={42}
                tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}s`}
              />
              <Tooltip
                contentStyle={{
                  background: t.tooltipBg,
                  border: `1px solid ${t.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.text,
                }}
                formatter={(v) => [fmtDuration(Number(v)), "p95"]}
              />
              <Line type="monotone" dataKey="p95" dot={false} strokeWidth={1.5} stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Health summary</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">window: last 24h · 100 batches</span>
        </div>
        <ul className="grid grid-cols-1 gap-y-1.5 px-4 py-3 text-[13px] text-zinc-700 sm:grid-cols-2 dark:text-zinc-200">
          <SummaryItem ok>
            Watermark advanced <span className="font-mono text-zinc-900 dark:text-zinc-50">{relTime(entity.watermark)}</span>.
          </SummaryItem>
          <SummaryItem ok={!!lastBatch && lastBatch.status === "ok"}>
            Last batch:{" "}
            <span className="font-mono text-zinc-900 dark:text-zinc-50">{fmtNumber(lastBatch?.rows_in ?? 0)} rows</span>{" "}
            in <span className="font-mono">{fmtDuration(lastBatch?.duration_ms ?? 0)}</span>.
          </SummaryItem>
          <SummaryItem ok={errRate100 < 1}>
            Error rate over last 100 batches:{" "}
            <span className="font-mono">{errRate100.toFixed(2)}%</span>.
          </SummaryItem>
          <SummaryItem ok={dqEsc24h === 0}>
            {dqEsc24h === 0
              ? "No DQ violations escalated to error in the last 24h."
              : `${dqEsc24h} DQ violations escalated to error in the last 24h.`}
          </SummaryItem>
        </ul>
      </Card>
    </div>
  );
}

function EntityBatches({
  entity, batches, go,
}: {
  entity: Entity; batches: BatchRun[]; go: (r: Route) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Recent batches · <span className="font-mono">{entity.name}</span>
        </h3>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">showing latest {batches.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-3 py-2 font-medium">batch_id</th>
              <th className="px-3 py-2 font-medium">started</th>
              <th className="px-3 py-2 font-medium">duration</th>
              <th className="px-3 py-2 font-medium">status</th>
              <th className="px-3 py-2 text-right font-medium">rows_in</th>
              <th className="px-3 py-2 text-right font-medium">rows_out</th>
              <th className="px-3 py-2 text-right font-medium">rejected</th>
              <th className="px-3 py-2 font-medium">wm advanced by</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const adv = +new Date(b.watermark_after) - +new Date(b.watermark_before);
              return (
                <tr
                  key={b.batch_id}
                  onClick={() =>
                    go({ name: "run", batchId: b.batch_id, from: { name: "entity", entity: entity.name } })
                  }
                  className="cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50/70 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2 font-mono text-[12px] text-zinc-700 dark:text-zinc-200">{b.batch_id}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300" title={fmtTs(b.started_at)}>{relTime(b.started_at)}</td>
                  <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">{fmtDuration(b.duration_ms)}</td>
                  <td className="px-3 py-2"><StatusPill status={b.status} size="sm" /></td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-200">{fmtNumber(b.rows_in)}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-200">{fmtNumber(b.rows_out)}</td>
                  <td className={cx("px-3 py-2 text-right font-mono", b.rows_rejected > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-400 dark:text-zinc-500")}>
                    {fmtNumber(b.rows_rejected)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
                    {adv > 0 ? fmtDuration(adv) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function yamlForEntity(e: Entity): string {
  const validations = RULE_BANK.filter((r) => r.entities.includes(e.name));
  const fieldBlock =
    e.name === "customer"
      ? `  - { source: KUNNR,        target: customer_id,   key: true }
  - { source: NAME1,        target: name }
  - { source: LAND1,        target: country,       lookup: iso_country }
  - { source: KTOKD,        target: account_group }
  - { source: ERDAT,        target: created_at,    transform: sap_date }`
      : e.name === "material"
      ? `  - { source: MATNR,        target: material_id,   key: true }
  - { source: MAKTX,        target: name }
  - { source: MATKL,        target: material_group }
  - { source: MEINS,        target: base_uom,      lookup: uom }
  - { source: MTART,        target: type }`
      : e.name === "sales_order"
      ? `  - { source: VBELN,        target: order_id,      key: true }
  - { source: KUNNR,        target: customer_ref,  lookup: customer }
  - { source: AUDAT,        target: created_at,    transform: sap_date }
  - { source: NETWR,        target: net_value }
  - { source: WAERK,        target: currency }`
      : e.name === "pricing_condition"
      ? `  - { source: KNUMH,        target: condition_id,  key: true }
  - { source: KSCHL,        target: condition_type }
  - { source: DATAB,        target: valid_from,    transform: sap_date }
  - { source: DATBI,        target: valid_to,      transform: sap_date }
  - { source: KBETR,        target: rate }`
      : `  - { source: ID,           target: id,            key: true }
  - { source: TEXT,         target: name }
  - { source: CREATED,      target: created_at,    transform: sap_date }`;

  return `# rules/${e.name}.yaml
odata:
  service: ${e.service}
  entity_set: ${e.entitySet}
  delta_token: true
  page_size: 1000

schedule:
  cron: "${e.schedule}"
  jitter_seconds: 15

fields:
${fieldBlock}

validations:
${validations
  .map(
    (r) => `  - id: ${r.id}
    severity: error
    expr: # ${r.message}`
  )
  .join("\n")}

write_mode: upsert
target: ${e.target}
`;
}

function highlightYaml(src: string): React.ReactNode[] {
  return src.split("\n").map((line, i) => {
    let body: React.ReactNode;
    if (/^\s*#/.test(line)) {
      body = <span className="text-zinc-400 dark:text-zinc-500">{line}</span>;
    } else {
      const m = line.match(/^(\s*-?\s*)([\w_]+)(:)(\s*)(.*)$/);
      if (m) {
        const value = m[5];
        const valueNode = /^"[^"]*"$/.test(value) ? (
          <span className="text-emerald-700 dark:text-emerald-300">{value}</span>
        ) : /^(true|false|null|\d+)$/i.test(value) ? (
          <span className="text-amber-700 dark:text-amber-300">{value}</span>
        ) : (
          <span className="text-zinc-700 dark:text-zinc-200">{value}</span>
        );
        body = (
          <>
            <span>{m[1]}</span>
            <span className="text-violet-700 dark:text-violet-300">{m[2]}</span>
            <span className="text-zinc-400">{m[3]}</span>
            <span>{m[4]}</span>
            {valueNode}
          </>
        );
      } else {
        body = <span className="text-zinc-700 dark:text-zinc-200">{line}</span>;
      }
    }
    return (
      <div key={i} className="flex">
        <span className="w-10 select-none pr-3 text-right font-mono text-[11px] text-zinc-300 dark:text-zinc-600">{i + 1}</span>
        <span className="whitespace-pre font-mono text-[12.5px] leading-[1.6]">{body}</span>
      </div>
    );
  });
}

function EntityRuleFile({ entity }: { entity: Entity }) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <GitBranch className="size-3.5 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="font-mono">rules/{entity.name}.yaml</span>
          </h3>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">read-only</span>
        </div>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ExternalLink className="size-3.5" />
          View on GitHub
          <ArrowUpRight className="size-3" />
        </a>
      </div>
      <div className="overflow-auto px-4 py-3">{highlightYaml(yamlForEntity(entity))}</div>
    </Card>
  );
}

function EntityWatermarkHistory({
  entity, batches, go,
}: {
  entity: Entity; batches: BatchRun[]; go: (r: Route) => void;
}) {
  const points = batches
    .slice()
    .reverse()
    .map((b) => ({
      t: +new Date(b.started_at),
      wm: +new Date(b.watermark_after),
      batch: b.batch_id,
      status: b.status,
    }));
  if (points.length === 0) {
    return (
      <Card className="p-8 text-center text-[12px] text-zinc-400">No watermark history yet.</Card>
    );
  }
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const minW = Math.min(...points.map((p) => p.wm));
  const maxW = Math.max(...points.map((p) => p.wm));

  const W = 800;
  const H = 200;
  const padL = 56;
  const padR = 24;
  const padT = 18;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xFor = (t: number) => padL + ((t - minT) / Math.max(1, maxT - minT)) * innerW;
  const yFor = (wm: number) => padT + innerH - ((wm - minW) / Math.max(1, maxW - minW)) * innerH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${xFor(p.t).toFixed(1)} ${yFor(p.wm).toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Watermark advancement</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">x = wall-clock · y = watermark timestamp</span>
        </div>
        <div className="overflow-x-auto">
          <svg width={W} height={H} className="text-zinc-300 dark:text-zinc-700">
            <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" />
            <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" />
            <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="10" fill="currentColor">newest</text>
            <text x={padL - 6} y={H - padB} textAnchor="end" fontSize="10" fill="currentColor">oldest</text>
            <defs>
              <linearGradient id="bf-wm" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#2563eb" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path d={path} fill="none" stroke="url(#bf-wm)" strokeWidth={1.5} />
            {points.map((p) => (
              <circle
                key={p.batch}
                cx={xFor(p.t)}
                cy={yFor(p.wm)}
                r={3}
                fill={p.status === "error" ? "#f43f5e" : "#7c3aed"}
                className="cursor-pointer"
                onClick={() =>
                  go({ name: "run", batchId: p.batch, from: { name: "entity", entity: entity.name } })
                }
              >
                <title>
                  {p.batch}
                  {"\n"}wall: {fmtTs(new Date(p.t).toISOString())}
                  {"\n"}wm: {fmtTs(new Date(p.wm).toISOString())}
                </title>
              </circle>
            ))}
          </svg>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Advancement log</h3>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">latest first</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {batches.map((b) => {
            const adv = +new Date(b.watermark_after) - +new Date(b.watermark_before);
            return (
              <div
                key={b.batch_id}
                onClick={() =>
                  go({ name: "run", batchId: b.batch_id, from: { name: "entity", entity: entity.name } })
                }
                className="grid cursor-pointer grid-cols-[180px_1fr_140px_90px] items-center gap-3 border-b border-zinc-100 px-4 py-2 text-[12.5px] last:border-b-0 hover:bg-zinc-50/70 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
              >
                <div className="font-mono text-zinc-700 dark:text-zinc-200" title={fmtTs(b.started_at)}>
                  {relTime(b.started_at)}
                </div>
                <div className="truncate font-mono text-zinc-500 dark:text-zinc-400">{b.batch_id}</div>
                <div
                  className={cx(
                    "font-mono",
                    adv > 0 ? "text-zinc-700 dark:text-zinc-200" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {adv > 0 ? `+${fmtDuration(adv)}` : "no advance"}
                </div>
                <div><StatusPill status={b.status} size="sm" /></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function EntityDetail({
  entity, go, toggleEntity, triggerEntity, resetEntity, theme, batches,
}: {
  entity: Entity;
  go: (r: Route) => void;
  toggleEntity: (name: string) => void;
  triggerEntity: (name: string) => void;
  resetEntity: (name: string) => void;
  theme: "light" | "dark";
  batches: BatchRun[];
}) {
  const [tab, setTab] = useState<"overview" | "batches" | "rule" | "watermark">("overview");
  const [flash, setFlash] = useState<string | null>(null);
  const Icon = entityIcon(entity.kind);
  const recent = useMemo(
    () => batches.filter((b) => b.entity === entity.name).slice(0, 50),
    [batches, entity.name]
  );

  function action(msg: string, fn: () => void) {
    fn();
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1800);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-200 px-6 pt-6 pb-4 dark:border-zinc-800">
        <Button variant="ghost" size="sm" onClick={() => go({ name: "dashboard" })} className="!px-1.5">
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-mono text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {entity.name}
                </h1>
                <StatusPill status={entity.status} />
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {entity.kind}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                <span><span className="text-zinc-400">OData:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{entity.service}/{entity.entitySet}</span></span>
                <span><span className="text-zinc-400">Schedule:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{entity.schedule}</span></span>
                <span><span className="text-zinc-400">Target:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{entity.target}</span></span>
                <span><span className="text-zinc-400">Watermark:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200" title={fmtTs(entity.watermark)}>{relTime(entity.watermark)}</span></span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {flash && <span className="text-[12px] text-emerald-600 dark:text-emerald-400">{flash}</span>}
            {entity.status === "paused" ? (
              <Button variant="outline" size="sm" onClick={() => action("Resumed", () => toggleEntity(entity.name))}>
                <Play className="size-3.5" />
                Resume
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => action("Paused", () => toggleEntity(entity.name))}>
                <Pause className="size-3.5" />
                Pause
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => action("Sync triggered", () => triggerEntity(entity.name))}>
              <Zap className="size-3.5" />
              Trigger Sync
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm(`Reset watermark for "${entity.name}"?\n\nThis re-reads history on the next batch.`)) {
                  action("Watermark reset", () => resetEntity(entity.name));
                }
              }}
            >
              <Rewind className="size-3.5" />
              Reset Watermark
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-0.5 border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              ["overview", "Overview"],
              ["batches", "Recent batches"],
              ["rule", "Rule file"],
              ["watermark", "Watermark history"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cx(
                "relative -mb-px px-3 py-2 text-[13px] transition-colors",
                tab === id
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {label}
              {tab === id && <span className="bifrost-gradient absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {tab === "overview" && <EntityOverview entity={entity} theme={theme} />}
        {tab === "batches" && <EntityBatches entity={entity} batches={recent} go={go} />}
        {tab === "rule" && <EntityRuleFile entity={entity} />}
        {tab === "watermark" && <EntityWatermarkHistory entity={entity} batches={recent} go={go} />}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Run Detail                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function KV({ k, v }: { k: string; v: number | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">{k}</span>
      <span className="font-mono text-zinc-800 dark:text-zinc-100">
        {v == null ? "—" : fmtNumber(v)}
      </span>
    </div>
  );
}

function ReconRow({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[12.5px]">
      <span
        className={cx(
          "rounded px-1.5 py-0.5 font-mono text-[11px]",
          highlight
            ? "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        )}
      >
        {label}
      </span>
      <span className="font-mono text-zinc-800 dark:text-zinc-100">{fmtNumber(value)}</span>
    </div>
  );
}

function RunDetail({
  batch, go, from,
}: {
  batch: BatchRun; go: (r: Route) => void; from?: Route;
}) {
  const [openStep, setOpenStep] = useState<StepName | null>(null);
  const [tab, setTab] = useState<"errors" | "dq">("errors");
  const [q, setQ] = useState("");

  const errs = useMemo(() => ERRORS.filter((e) => e.batch_id === batch.batch_id), [batch.batch_id]);
  const filteredErrs = useMemo(() => {
    const t = q.trim().toLowerCase();
    let rows = errs;
    if (tab === "dq") rows = rows.filter((e) => e.rule_id.startsWith("V-"));
    if (!t) return rows;
    return rows.filter(
      (e) =>
        e.rule_id.toLowerCase().includes(t) ||
        e.src_key.toLowerCase().includes(t) ||
        e.message.toLowerCase().includes(t)
    );
  }, [errs, q, tab]);

  const totalDuration = Math.max(1, batch.steps.reduce((a, s) => a + s.duration_ms, 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-200 px-6 pt-6 pb-4 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(from ?? { name: "entity", entity: batch.entity })}
          className="!px-1.5"
        >
          <ArrowLeft className="size-3.5" />
          {from?.name === "errors" ? "Error Explorer" : batch.entity}
        </Button>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-mono text-[20px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {batch.batch_id}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              <span>
                <span className="text-zinc-400">entity:</span>{" "}
                <button
                  type="button"
                  onClick={() => go({ name: "entity", entity: batch.entity })}
                  className="font-mono text-zinc-700 hover:underline dark:text-zinc-200"
                >
                  {batch.entity}
                </button>
              </span>
              <span><span className="text-zinc-400">started:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{fmtTs(batch.started_at)}</span></span>
              <span><span className="text-zinc-400">ended:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{fmtTs(batch.ended_at)}</span></span>
              <span><span className="text-zinc-400">duration:</span> <span className="font-mono text-zinc-700 dark:text-zinc-200">{fmtDuration(batch.duration_ms)}</span></span>
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-400">operator:</span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <Clock className="size-3" /> {batch.operator}
                </span>
              </span>
            </div>
          </div>
          <StatusPill status={batch.status} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Step timeline</h3>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">total {fmtDuration(batch.duration_ms)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {batch.steps.map((s, idx) => {
              const offsetMs = batch.steps.slice(0, idx).reduce((a, x) => a + x.duration_ms, 0);
              const widthPct = (s.duration_ms / totalDuration) * 100;
              const leftPct = (offsetMs / totalDuration) * 100;
              const isOpen = openStep === s.name;
              const isError = s.status === "error";
              const isDqWithViolations = s.name === "dq_round_2" && (s.violations ?? 0) > 0;
              return (
                <div key={s.name}>
                  <button
                    type="button"
                    onClick={() => setOpenStep(isOpen ? null : s.name)}
                    className="flex w-full items-center gap-3 rounded-md py-1.5 pl-2 pr-3 text-left text-[12.5px] hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <ChevronRight className={cx("size-3.5 shrink-0 text-zinc-400 transition-transform", isOpen && "rotate-90")} />
                    <span className="w-44 shrink-0 font-mono text-zinc-700 dark:text-zinc-200">{s.name}</span>
                    <span className="relative h-4 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                      <span
                        className={cx(
                          "absolute top-0 h-full rounded",
                          isError
                            ? "bg-gradient-to-r from-rose-500 to-rose-400"
                            : isDqWithViolations
                            ? "bg-gradient-to-r from-amber-500 to-amber-400"
                            : "bg-gradient-to-r from-violet-500 to-blue-500"
                        )}
                        style={{ left: `${leftPct}%`, width: `${Math.max(0.4, widthPct)}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-mono text-zinc-600 dark:text-zinc-300">{fmtDuration(s.duration_ms)}</span>
                    {isError ? (
                      <AlertTriangle className="size-3.5 text-rose-500" />
                    ) : (
                      <Check className="size-3.5 text-emerald-500" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="ml-9 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-md bg-zinc-50 px-3 py-2 text-[12px] sm:grid-cols-4 dark:bg-zinc-900">
                      <KV k="rows" v={s.rows} />
                      <KV k="rows_in" v={s.rows_in} />
                      <KV k="rows_out" v={s.rows_out} />
                      <KV k="violations" v={s.violations} />
                      {isError && (
                        <div className="col-span-full mt-1 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[12px] text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
                          <AlertTriangle className="mr-1 inline size-3" />
                          step failed — see Errors panel below
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Errors & DQ violations</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="filter rule / key / message"
                    className="w-56 rounded border border-zinc-200 bg-white py-1 pl-7 pr-2 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-1 rounded border border-zinc-200 p-0.5 text-[11px] dark:border-zinc-800">
                  {(["errors", "dq"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={cx(
                        "rounded px-2 py-0.5 transition-colors",
                        tab === k
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      )}
                    >
                      {k === "errors"
                        ? `Errors (${errs.length})`
                        : `DQ (${errs.filter((e) => e.rule_id.startsWith("V-")).length})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredErrs.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12px] text-zinc-400">
                No {tab === "dq" ? "DQ violations" : "errors"} on this batch.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="px-3 py-2 font-medium"></th>
                      <th className="px-3 py-2 font-medium">rule_id</th>
                      <th className="px-3 py-2 font-medium">step</th>
                      <th className="px-3 py-2 font-medium">source_keys</th>
                      <th className="px-3 py-2 font-medium">message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredErrs.map((e) => (
                      <tr key={e.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60">
                        <td className="px-3 py-2 align-top"><SeverityIcon severity={e.severity} /></td>
                        <td className="px-3 py-2 align-top font-mono text-zinc-700 dark:text-zinc-200">{e.rule_id}</td>
                        <td className="px-3 py-2 align-top font-mono text-zinc-500 dark:text-zinc-400">{e.step}</td>
                        <td className="px-3 py-2 align-top font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300">{e.src_key}</td>
                        <td className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-200">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Reconciliation</h3>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">row counts per layer</p>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <ReconRow label="raw" value={batch.rows_in} />
              <ReconRow label="stg" value={batch.rows_in} />
              <ReconRow label="xfm" value={batch.rows_in} />
              <ReconRow label="app" value={batch.rows_out} highlight />
            </div>
            <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-zinc-500 dark:text-zinc-400">watermark advanced by</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-100">
                  {(() => {
                    const adv = +new Date(batch.watermark_after) - +new Date(batch.watermark_before);
                    return adv > 0 ? `+${fmtDuration(adv)}` : "none";
                  })()}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11.5px] text-zinc-500 dark:text-zinc-400">
                <span className="font-mono" title={fmtTs(batch.watermark_before)}>
                  {fmtTs(batch.watermark_before).slice(11, 19)}Z
                </span>
                <ArrowRight className="size-3" />
                <span className="font-mono text-zinc-700 dark:text-zinc-200" title={fmtTs(batch.watermark_after)}>
                  {fmtTs(batch.watermark_after).slice(11, 19)}Z
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Error Explorer                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      {children}
    </div>
  );
}

function ErrorExplorer({
  entities, go, theme,
}: {
  entities: Entity[]; go: (r: Route) => void; theme: "light" | "dark";
}) {
  const [selEntities, setSelEntities] = useState<Set<string>>(new Set());
  const [selSeverities, setSelSeverities] = useState<Set<Severity>>(
    new Set(["error", "critical", "warning"])
  );
  const [selRules, setSelRules] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<"1h" | "24h" | "7d">("24h");
  const [selSteps, setSelSteps] = useState<Set<StepName>>(new Set());
  const [ruleQuery, setRuleQuery] = useState("");
  const t = chartTheme(theme);

  const filtered = useMemo(() => {
    const cutoff =
      range === "1h" ? NOW - hours(1) :
      range === "24h" ? NOW - hours(24) :
      NOW - hours(24 * 7);
    return ERRORS.filter((e) => {
      if (+new Date(e.run_ts) < cutoff) return false;
      if (selEntities.size > 0 && !selEntities.has(e.entity)) return false;
      if (selSeverities.size > 0 && !selSeverities.has(e.severity)) return false;
      if (selRules.size > 0 && !selRules.has(e.rule_id)) return false;
      if (selSteps.size > 0 && !selSteps.has(e.step)) return false;
      return true;
    }).sort((a, b) => +new Date(b.run_ts) - +new Date(a.run_ts));
  }, [range, selEntities, selSeverities, selRules, selSteps]);

  const ruleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.rule_id, (m.get(e.rule_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const keyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.src_key, (m.get(e.src_key) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const sevDist = useMemo(() => {
    const m = new Map<Severity, number>();
    for (const e of filtered) m.set(e.severity, (m.get(e.severity) ?? 0) + 1);
    return [
      { name: "critical", value: m.get("critical") ?? 0, color: "#9f1239" },
      { name: "error",    value: m.get("error") ?? 0,    color: "#f43f5e" },
      { name: "warning",  value: m.get("warning") ?? 0,  color: "#f59e0b" },
      { name: "info",     value: m.get("info") ?? 0,     color: "#a1a1aa" },
    ].filter((x) => x.value > 0);
  }, [filtered]);

  const ruleList = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    return RULE_BANK.filter(
      (r) => !q || r.id.toLowerCase().includes(q) || r.message.toLowerCase().includes(q)
    );
  }, [ruleQuery]);

  function toggle<T>(s: Set<T>, v: T): Set<T> {
    const n = new Set(s);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  }
  const activeFilterCount =
    selEntities.size +
    (selSeverities.size === 3 ? 0 : selSeverities.size) +
    selRules.size +
    selSteps.size;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Error Explorer
            </h1>
            <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Cross-entity DQ and runtime errors · {fmtNumber(filtered.length)} matching of {fmtNumber(ERRORS.length)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 text-[11px] dark:border-zinc-800">
              {(["1h", "24h", "7d"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cx(
                    "rounded px-2 py-0.5 transition-colors",
                    range === r
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  )}
                >
                  last {r}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelEntities(new Set());
                setSelSeverities(new Set(["error", "critical", "warning"]));
                setSelRules(new Set());
                setSelSteps(new Set());
                setRuleQuery("");
              }}
            >
              <RefreshCw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
        {activeFilterCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ListFilter className="size-3" />
            {activeFilterCount} active filters
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_300px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <FilterGroup label="Entity">
            <div className="flex flex-col gap-1">
              {entities.map((e) => (
                <label
                  key={e.name}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    className="size-3 accent-violet-600"
                    checked={selEntities.has(e.name)}
                    onChange={() => setSelEntities(toggle(selEntities, e.name))}
                  />
                  <span className="flex-1 truncate font-mono text-zinc-700 dark:text-zinc-200">{e.name}</span>
                  <StatusDot status={e.status} />
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Severity">
            <div className="flex flex-col gap-1">
              {(["critical", "error", "warning", "info"] as Severity[]).map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    className="size-3 accent-violet-600"
                    checked={selSeverities.has(s)}
                    onChange={() => setSelSeverities(toggle(selSeverities, s))}
                  />
                  <SeverityIcon severity={s} />
                  <span className="capitalize text-zinc-700 dark:text-zinc-200">{s}</span>
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Rule ID">
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-400" />
              <input
                value={ruleQuery}
                onChange={(e) => setRuleQuery(e.target.value)}
                placeholder="type to filter…"
                className="w-full rounded border border-zinc-200 bg-white py-1 pl-7 pr-2 text-[11px] text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
            <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
              {ruleList.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    className="size-3 accent-violet-600"
                    checked={selRules.has(r.id)}
                    onChange={() => setSelRules(toggle(selRules, r.id))}
                  />
                  <span className="font-mono text-zinc-700 dark:text-zinc-200">{r.id}</span>
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label="Step">
            <div className="flex flex-wrap gap-1">
              {(
                ["pre_flight", "extract", "stage", "transform", "write", "dq_round_1", "dq_round_2", "dq_round_3"] as StepName[]
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelSteps(toggle(selSteps, s))}
                  className={cx(
                    "rounded border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors",
                    selSteps.has(s)
                      ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </FilterGroup>
        </aside>

        <main className="min-h-0 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-white text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">time</th>
                <th className="px-3 py-2 font-medium">entity</th>
                <th className="px-3 py-2 font-medium">batch_id</th>
                <th className="px-3 py-2 font-medium">sev</th>
                <th className="px-3 py-2 font-medium">step</th>
                <th className="px-3 py-2 font-medium">rule_id</th>
                <th className="px-3 py-2 font-medium">source_keys</th>
                <th className="px-3 py-2 font-medium">message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-16 text-center text-[12px] text-zinc-400">
                    No errors match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-zinc-600 dark:text-zinc-300" title={fmtTs(e.run_ts)}>
                    {relTime(e.run_ts)}
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => go({ name: "entity", entity: e.entity })}
                      className="font-mono text-zinc-700 hover:underline dark:text-zinc-200"
                    >
                      {e.entity}
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => go({ name: "run", batchId: e.batch_id, from: { name: "errors" } })}
                      className="font-mono text-[11.5px] text-violet-700 hover:underline dark:text-violet-300"
                    >
                      {e.batch_id}
                    </button>
                  </td>
                  <td className="px-3 py-1.5"><SeverityIcon severity={e.severity} /></td>
                  <td className="px-3 py-1.5 font-mono text-zinc-500 dark:text-zinc-400">{e.step}</td>
                  <td className="px-3 py-1.5 font-mono text-zinc-700 dark:text-zinc-200">{e.rule_id}</td>
                  <td className="max-w-[220px] truncate px-3 py-1.5 font-mono text-[11.5px] text-zinc-600 dark:text-zinc-300" title={e.src_key}>
                    {e.src_key}
                  </td>
                  <td className="max-w-[360px] truncate px-3 py-1.5 text-zinc-700 dark:text-zinc-200" title={e.message}>
                    {e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>

        <aside className="overflow-y-auto border-l border-zinc-200 p-4 dark:border-zinc-800">
          <div className="space-y-4">
            <Card className="p-3">
              <h4 className="mb-2 text-[12px] font-semibold text-zinc-900 dark:text-zinc-50">Top rules</h4>
              {ruleCounts.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-zinc-400">no matches</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ruleCounts.map(([id, n]) => {
                    const max = ruleCounts[0][1];
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200">{id}</span>
                        <span className="relative h-3 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                          <span
                            className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-violet-500 to-blue-500"
                            style={{ width: `${(n / max) * 100}%` }}
                          />
                        </span>
                        <span className="w-8 shrink-0 text-right font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{n}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-3">
              <h4 className="mb-2 text-[12px] font-semibold text-zinc-900 dark:text-zinc-50">Top source keys</h4>
              {keyCounts.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-zinc-400">no matches</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {keyCounts.map(([k, n]) => (
                    <div key={k} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 truncate font-mono text-zinc-600 dark:text-zinc-300" title={k}>
                        {k}
                      </span>
                      <span className="rounded bg-zinc-100 px-1 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-3">
              <h4 className="mb-2 text-[12px] font-semibold text-zinc-900 dark:text-zinc-50">Severity distribution</h4>
              {sevDist.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-zinc-400">no matches</p>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="size-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sevDist}
                          dataKey="value"
                          innerRadius={28}
                          outerRadius={50}
                          stroke="none"
                          paddingAngle={1.5}
                        >
                          {sevDist.map((s) => (
                            <Cell key={s.name} fill={s.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: t.tooltipBg,
                            border: `1px solid ${t.tooltipBorder}`,
                            borderRadius: 8,
                            fontSize: 12,
                            color: t.text,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-[11px]">
                    {sevDist.map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        <span className="capitalize text-zinc-700 dark:text-zinc-200">{s.name}</span>
                        <span className="ml-auto font-mono text-zinc-500 dark:text-zinc-400">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* App shell                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "dashboard" });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("bifrost-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [batches, setBatches] = useState<BatchRun[]>([]);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [entRes, batchRes, alertRes] = await Promise.all([
          fetch(`${API_BASE}/api/entities`),
          fetch(`${API_BASE}/api/batches?limit=200`),
          fetch(`${API_BASE}/api/alerts`),
        ]);
        if (entRes.ok) {
          const { entities: raw } = await entRes.json() as { entities: Record<string, unknown>[] };
          setEntities(raw.map(mapGatewayEntity));
        }
        if (batchRes.ok) {
          const { batches: raw } = await batchRes.json() as { batches: Record<string, unknown>[] };
          setBatches(raw.map(mapGatewayBatch));
        }
        if (alertRes.ok) {
          const { alerts: raw } = await alertRes.json() as { alerts: Record<string, unknown>[] };
          setAlerts(raw.map(mapGatewayAlert));
        }
        setApiReady(true);
      } catch {
        // Gateway not reachable
        setApiReady(false);
      }
    }
    fetchAll();
    const id = window.setInterval(fetchAll, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("bifrost-theme", theme);
  }, [theme]);

  function go(r: Route) {
    setRoute(r);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  function toggleEntity(name: string) {
    const entity = entities.find((e) => e.name === name);
    const newStatus = entity?.status === "paused" ? "active" : "paused";
    // Optimistic UI update
    setEntities((prev) =>
      prev.map((e) => e.name === name ? { ...e, status: newStatus === "paused" ? "paused" : "healthy" } : e)
    );
    fetch(`${API_BASE}/api/entities/${name}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(console.error);
  }
  function triggerEntity(name: string) {
    fetch(`${API_BASE}/api/entities/${name}/trigger`, { method: "POST" }).catch(console.error);
  }
  function resetEntity(name: string) {
    // Watermark reset is a future feature — just retrigger a sync for now
    fetch(`${API_BASE}/api/entities/${name}/trigger`, { method: "POST" }).catch(console.error);
  }
  function ack(id: string) {
    // Optimistic UI update
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    fetch(`${API_BASE}/api/alerts/${id}/ack`, { method: "PATCH" }).catch(console.error);
  }

  const breadcrumbs = useMemo<{ label: string; route?: Route }[]>(() => {
    if (route.name === "dashboard") return [{ label: "Dashboard" }];
    if (route.name === "errors")
      return [{ label: "Dashboard", route: { name: "dashboard" } }, { label: "Error Explorer" }];
    if (route.name === "entity")
      return [
        { label: "Dashboard", route: { name: "dashboard" } },
        { label: route.entity },
      ];
    const batch = batches.find((b) => b.batch_id === route.batchId);
    const entity = batch?.entity ?? "unknown";
    const crumbs: { label: string; route?: Route }[] = [
      { label: "Dashboard", route: { name: "dashboard" } },
    ];
    if (route.from?.name === "errors") {
      crumbs.push({ label: "Error Explorer", route: { name: "errors" } });
    } else {
      crumbs.push({ label: entity, route: { name: "entity", entity } });
    }
    crumbs.push({ label: batch?.batch_id ?? route.batchId });
    return crumbs;
  }, [route, batches]);

  const activeAlertCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex h-full min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <NavRail route={route} go={go} entities={entities} alertCount={activeAlertCount} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar theme={theme} setTheme={setTheme} breadcrumbs={breadcrumbs} go={go} />
        <div className="flex min-h-0 flex-1 flex-col">
          {!apiReady && entities.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-12 text-zinc-500 dark:text-zinc-400">
              <div className="flex flex-col items-center gap-3 text-center">
                <Database className="size-8 opacity-40" />
                <p className="text-sm font-medium">Connecting to BiFrost gateway…</p>
                <p className="text-xs opacity-60">Make sure the gateway is running on <span className="font-mono">http://localhost:3001</span></p>
              </div>
            </div>
          )}
          {(apiReady || entities.length > 0) && route.name === "dashboard" && (
            <Dashboard
              entities={entities}
              batches={batches}
              alerts={alerts}
              ack={ack}
              toggleEntity={toggleEntity}
              triggerEntity={triggerEntity}
              resetEntity={resetEntity}
              go={go}
            />
          )}
          {route.name === "entity" &&
            (() => {
              const e = entities.find((x) => x.name === route.entity);
              if (!e) {
                return (
                  <div className="flex flex-1 items-center justify-center p-12 text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <X className="size-6" />
                      <p>Unknown entity "{route.entity}"</p>
                      <Button variant="outline" size="sm" onClick={() => go({ name: "dashboard" })}>
                        Back to dashboard
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <EntityDetail
                  entity={e}
                  go={go}
                  toggleEntity={toggleEntity}
                  triggerEntity={triggerEntity}
                  resetEntity={resetEntity}
                  theme={theme}
                  batches={batches}
                />
              );
            })()}
          {route.name === "run" &&
            (() => {
              const b = batches.find((x) => x.batch_id === route.batchId);
              if (!b) {
                return (
                  <div className="flex flex-1 items-center justify-center p-12 text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <X className="size-6" />
                      <p>Unknown batch "{route.batchId}"</p>
                      <Button variant="outline" size="sm" onClick={() => go({ name: "dashboard" })}>
                        Back to dashboard
                      </Button>
                    </div>
                  </div>
                );
              }
              return <RunDetail batch={b} go={go} from={route.from} />;
            })()}
          {route.name === "errors" && <ErrorExplorer entities={entities} go={go} theme={theme} />}
        </div>
      </div>
    </div>
  );
}
